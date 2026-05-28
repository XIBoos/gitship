import { existsSync } from 'fs';
import { join } from 'path';
import { exec, execStrict } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import type { AuthConfig } from '../types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';

export class GitManager {
  async setupAuth(auth: AuthConfig): Promise<void> {
    if (auth.ssh_private_key) {
      await this.setupSSH(auth.ssh_private_key, auth.ssh_known_hosts);
    } else if (auth.username && auth.token) {
      await this.setupHTTPS(auth.username, auth.token);
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

  private async setupHTTPS(username: string, token: string): Promise<void> {
    await execStrict('git', ['config', '--global', 'credential.helper', 'store']);

    const credentialUrl = `https://${username}:${token}@gitea.example.com`;
    const credentialFile = join(homedir(), '.git-credentials');
    writeFileSync(credentialFile, credentialUrl + '\n', { mode: 0o600 });

    logger.debug('HTTPS credentials configured');
  }

  isRepoCached(cacheDir: string): boolean {
    return existsSync(join(cacheDir, '.git'));
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
  ): Promise<string> {
    if (!existsSync(workDir)) {
      mkdirSync(workDir, { recursive: true });
    }

    await execStrict('git', ['clone', repoDir, workDir]);

    const refArg = this.isCommitHash(ref) ? ref : `origin/${ref}`;
    await execStrict('git', ['checkout', refArg], { cwd: workDir });

    const hash = await execStrict('git', ['rev-parse', 'HEAD'], { cwd: workDir });
    const commitHash = hash.trim();

    logger.info(`Checked out commit: ${commitHash}`);
    return commitHash;
  }

  private isCommitHash(ref: string): boolean {
    return /^[a-f0-9]{40}$/i.test(ref);
  }

  async getBranchHead(repoDir: string, branch: string): Promise<string> {
    const result = await execStrict('git', ['rev-parse', `refs/heads/${branch}`], { cwd: repoDir });
    return result.trim();
  }
}