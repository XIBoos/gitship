import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { CacheConfig } from '../types.js';
import { logger } from '../utils/logger.js';

export class CacheManager {
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.ensureCacheDirs();
  }

  private ensureCacheDirs(): void {
    const reposDir = join(this.config.dir, 'repos');
    const depsDir = join(this.config.dir, 'deps');

    if (!existsSync(reposDir)) {
      mkdirSync(reposDir, { recursive: true });
    }
    if (!existsSync(depsDir)) {
      mkdirSync(depsDir, { recursive: true });
    }
  }

  private hashUrl(url: string): string {
    return createHash('md5').update(url).digest('hex').substring(0, 12);
  }

  getRepoCacheDir(repoUrl: string): string {
    const hash = this.hashUrl(repoUrl);
    return join(this.config.dir, 'repos', hash);
  }

  getDepsCacheDir(repoUrl: string): string {
    const hash = this.hashUrl(repoUrl);
    return join(this.config.dir, 'deps', hash);
  }

  needsReinstall(repoDir: string, repoUrl: string): boolean {
    const repoLockPath = join(repoDir, 'package-lock.json');
    const cacheDir = this.getDepsCacheDir(repoUrl);
    const cachedLockPath = join(cacheDir, 'package-lock.json');

    if (!existsSync(repoLockPath)) {
      logger.debug('No package-lock.json in repo, needs install');
      return true;
    }

    if (!existsSync(cachedLockPath)) {
      logger.debug('No cached package-lock.json, needs install');
      return true;
    }

    const repoLock = readFileSync(repoLockPath, 'utf-8');
    const cachedLock = readFileSync(cachedLockPath, 'utf-8');

    const needs = repoLock !== cachedLock;
    logger.debug(`package-lock.json comparison: ${needs ? 'changed' : 'unchanged'}`);

    return needs;
  }

  updateDepsCache(repoDir: string, repoUrl: string): void {
    const repoLockPath = join(repoDir, 'package-lock.json');
    const cacheDir = this.getDepsCacheDir(repoUrl);

    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    if (existsSync(repoLockPath)) {
      writeFileSync(join(cacheDir, 'package-lock.json'), readFileSync(repoLockPath));
      logger.debug('Updated cached package-lock.json');
    }
  }
}