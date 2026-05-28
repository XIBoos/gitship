import { join } from 'path';
import { existsSync, symlinkSync, mkdirSync, cpSync } from 'fs';
import { execStrict } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { CacheManager } from './cache.js';
import type { BuildConfig } from '../types.js';

export class BuildManager {
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  async install(
    repoDir: string,
    repoUrl: string,
    installCommand: string
  ): Promise<void> {
    const cacheDir = this.cacheManager.getDepsCacheDir(repoUrl);
    const cachedNodeModules = join(cacheDir, 'node_modules');
    const repoNodeModules = join(repoDir, 'node_modules');

    const needsReinstall = this.cacheManager.needsReinstall(repoDir, repoUrl);

    if (!needsReinstall && existsSync(cachedNodeModules)) {
      logger.info('Using cached node_modules');
      if (!existsSync(repoNodeModules)) {
        this.linkOrCopyNodeModules(cachedNodeModules, repoNodeModules);
      }
      return;
    }

    logger.info(`Running install: ${installCommand}`);

    const [cmd, ...args] = installCommand.split(' ');
    await execStrict(cmd, args, { cwd: repoDir });

    this.cacheNodeModules(repoDir, cacheDir);
    this.cacheManager.updateDepsCache(repoDir, repoUrl);

    logger.info('Dependencies installed and cached');
  }

  async build(repoDir: string, buildCommand: string): Promise<void> {
    logger.info(`Running build: ${buildCommand}`);

    const [cmd, ...args] = buildCommand.split(' ');
    await execStrict(cmd, args, { cwd: repoDir });

    logger.info('Build completed');
  }

  private cacheNodeModules(repoDir: string, cacheDir: string): void {
    const srcNodeModules = join(repoDir, 'node_modules');
    const destNodeModules = join(cacheDir, 'node_modules');

    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    if (existsSync(srcNodeModules)) {
      cpSync(srcNodeModules, destNodeModules, { recursive: true });
      logger.debug('node_modules cached');
    }
  }

  private linkOrCopyNodeModules(src: string, dest: string): void {
    try {
      symlinkSync(src, dest, 'junction');
      logger.debug('node_modules symlinked');
    } catch {
      cpSync(src, dest, { recursive: true });
      logger.debug('node_modules copied');
    }
  }
}