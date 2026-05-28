import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import type { DeployConfig, AuthConfig, DeployResult } from '../types.js';
import { GitManager } from '../core/git.js';
import { CacheManager } from '../core/cache.js';
import { BuildManager } from '../core/build.js';
import { OutputManager } from '../core/output.js';
import { NotifyManager } from '../utils/notify.js';
import { logger } from '../utils/logger.js';

export async function runOnce(
  config: DeployConfig,
  auth: AuthConfig
): Promise<DeployResult> {
  const gitManager = new GitManager();
  const cacheManager = new CacheManager(config.cache);
  const buildManager = new BuildManager(cacheManager);
  const outputManager = new OutputManager();
  const notifyManager = new NotifyManager();

  const timestamp = new Date().toISOString();
  let commitHash: string | undefined;

  try {
    // Step 1: Setup authentication
    logger.info('Setting up authentication...');
    await gitManager.setupAuth(auth);

    // Step 2: Clone or fetch repository
    logger.info('Fetching repository...');
    const repoCacheDir = cacheManager.getRepoCacheDir(config.repo.url);
    await gitManager.cloneOrFetch(config.repo.url, repoCacheDir);

    // Step 3: Checkout to work directory
    logger.info('Checking out code...');
    const workDir = join(config.cache.dir, 'work', Date.now().toString());
    if (existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true });
    }
    mkdirSync(workDir, { recursive: true });

    const ref = config.repo.version || config.repo.branch;
    commitHash = await gitManager.checkout(repoCacheDir, ref, workDir);

    // Determine project directory (support subdirectory)
    const projectDir = config.repo.subdirectory
      ? join(workDir, config.repo.subdirectory)
      : workDir;

    if (config.repo.subdirectory && !existsSync(projectDir)) {
      throw new Error(`Subdirectory "${config.repo.subdirectory}" does not exist in repository`);
    }

    // Step 4: Install dependencies
    logger.info('Installing dependencies...');
    await buildManager.install(projectDir, config.repo.url, config.build.install_command);

    // Step 5: Build
    logger.info('Building project...');
    await buildManager.build(projectDir, config.build.command);

    // Step 6: Determine build output directory
    const buildOutputDir = findBuildOutput(projectDir);

    // Step 7: Sync to output
    logger.info('Syncing to output directory...');
    await outputManager.sync(buildOutputDir, config.output.dir, config.output.exclude);

    // Success
    logger.info('Deployment completed successfully');

    const result: DeployResult = {
      success: true,
      commitHash,
      timestamp: new Date().toISOString(),
    };

    // Send success notification if configured
    if (config.error.on_error === 'notify' && config.error.webhook) {
      await notifyManager.send(config.error.webhook, {
        event: 'deploy_success',
        repo: config.repo.url,
        branch: config.repo.branch,
        version: config.repo.version,
        timestamp: result.timestamp,
      });
    }

    // Cleanup work directory
    rmSync(workDir, { recursive: true, force: true });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Deployment failed', { error: errorMessage });

    const result: DeployResult = {
      success: false,
      commitHash,
      error: errorMessage,
      stage: detectStage(error),
      timestamp: new Date().toISOString(),
    };

    // Send failure notification if configured
    if (config.error.webhook) {
      await notifyManager.send(config.error.webhook, {
        event: 'deploy_failed',
        repo: config.repo.url,
        branch: config.repo.branch,
        version: config.repo.version,
        stage: result.stage,
        error: errorMessage,
        timestamp: result.timestamp,
      });
    }

    return result;
  }
}

function findBuildOutput(workDir: string): string {
  const possibleDirs = ['dist', 'build', 'out', '.output', 'public'];

  for (const dir of possibleDirs) {
    const path = join(workDir, dir);
    if (existsSync(path)) {
      return path;
    }
  }

  return workDir;
}

function detectStage(error: unknown): 'git' | 'install' | 'build' | 'sync' {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('git') || message.includes('clone') || message.includes('checkout')) {
    return 'git';
  }
  if (message.includes('npm install') || message.includes('npm ci') || message.includes('yarn')) {
    return 'install';
  }
  if (message.includes('npm run build') || message.includes('build')) {
    return 'build';
  }
  return 'sync';
}
