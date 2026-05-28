import { existsSync } from 'fs';
import { join } from 'path';
import { exec, execStrict } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import type { AuthConfig } from '../types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';

export interface RepoInfo {
  url: string;
  branch: string;
  commit: string;
  tag?: string;
}

export class GitManager {
  async setupAuth(auth: AuthConfig, repoUrl?: string): Promise<void> {
    if (auth.ssh_private_key) {
      await this.setupSSH(auth.ssh_private_key, auth.ssh_known_hosts);
    } else if (auth.username && auth.token) {
      await this.setupHTTPS(auth.username, auth.token, repoUrl);
    }
  }

  private async setupSSH(privateKey: string, knownHosts?: string): Promise<void> {
    const sshDir = join(homedir(), '.ssh');
    if (!existsSync(sshDir)) {
      mkdirSync(sshDir, { recursive: true });
    }

    writeFileSync(join(sshDir, 'id_rsa'), privateKey, { mode: 0o600 });
    logger.debug('SSH private key written');

    if (knownHosts) {
      writeFileSync(join(sshDir, 'known_hosts'), knownHosts);
      logger.debug('SSH known_hosts written');
    }

    if (!knownHosts) {
      const sshConfig = join(sshDir, 'config');
      const configContent = `Host *
  StrictHostKeyChecking no
  UserKnownHostsFile=/dev/null
`;
      writeFileSync(sshConfig, configContent, { mode: 0o600 });
      logger.debug('SSH config written (no strict host key checking)');
    }
  }

  private async setupHTTPS(username: string, token: string, repoUrl?: string): Promise<void> {
    await execStrict('git', ['config', '--global', 'credential.helper', 'store']);

    // Extract host from repo URL, default to wildcard if not provided
    let host = '';
    if (repoUrl) {
      try {
        const url = new URL(repoUrl);
        host = url.host; // includes port if present (e.g., "192.168.1.190:3030")
      } catch {
        // If URL parsing fails, fall back to extracting host manually
        const match = repoUrl.match(/^https?:\/\/([^/]+)/);
        if (match) {
          host = match[1];
        }
      }
    }

    // Use the extracted host, or a wildcard pattern for all hosts
    const protocol = repoUrl?.startsWith('https') ? 'https' : 'http';
    const credentialUrl = host
      ? `${protocol}://${username}:${token}@${host}`
      : `https://${username}:${token}@*`;

    const credentialFile = join(homedir(), '.git-credentials');
    writeFileSync(credentialFile, credentialUrl + '\n', { mode: 0o600 });

    logger.info(`HTTPS credentials configured for host: ${host || 'all hosts'}`);
  }

  isRepoCached(cacheDir: string): boolean {
    // Mirror clone creates bare repo with HEAD file (not .git directory)
    return existsSync(join(cacheDir, 'HEAD')) || existsSync(join(cacheDir, '.git'));
  }

  async cloneOrFetch(repoUrl: string, cacheDir: string): Promise<string> {
    if (this.isRepoCached(cacheDir)) {
      logger.info(`Fetching updates for existing repo: ${cacheDir}`);
      await execStrict('git', ['fetch', '--all', '--tags'], { cwd: cacheDir });
    } else {
      logger.info(`Cloning repo: ${repoUrl}`);
      await execStrict('git', ['clone', '--mirror', repoUrl, cacheDir]);
    }

    return cacheDir;
  }

  async checkout(
    repoDir: string,
    ref: string,
    workDir: string
  ): Promise<{ commitHash: string; repoInfo: RepoInfo }> {
    if (!existsSync(workDir)) {
      mkdirSync(workDir, { recursive: true });
    }

    await execStrict('git', ['clone', repoDir, workDir]);

    const refArg = this.isCommitHash(ref) ? ref : `origin/${ref}`;
    await execStrict('git', ['checkout', refArg], { cwd: workDir });

    // Get repository info from git
    const commitHash = (await execStrict('git', ['rev-parse', 'HEAD'], { cwd: workDir })).trim();
    const shortHash = commitHash.substring(0, 7);

    // Get remote URL
    let remoteUrl = '';
    try {
      remoteUrl = (await execStrict('git', ['remote', 'get-url', 'origin'], { cwd: workDir })).trim();
    } catch {
      remoteUrl = '(unknown)';
    }

    // Get current branch
    let branch = '';
    try {
      branch = (await execStrict('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workDir })).trim();
      // If detached HEAD, branch will be "HEAD", try to get from ref
      if (branch === 'HEAD') {
        branch = ref;
      }
    } catch {
      branch = '(unknown)';
    }

    // Get current tag (if any)
    let tag = '';
    try {
      tag = (await execStrict('git', ['describe', '--tags', '--exact-match'], { cwd: workDir })).trim();
    } catch {
      // Not on a tag
    }

    logger.info(`Checked out commit: ${shortHash}`);

    return {
      commitHash,
      repoInfo: {
        url: remoteUrl,
        branch,
        commit: shortHash,
        tag: tag || undefined,
      },
    };
  }

  private isCommitHash(ref: string): boolean {
    return /^[a-f0-9]{40}$/i.test(ref);
  }

  async getBranchHead(repoDir: string, branch: string): Promise<string> {
    const result = await execStrict('git', ['rev-parse', `refs/heads/${branch}`], { cwd: repoDir });
    return result.trim();
  }
}