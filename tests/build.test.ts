import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BuildManager } from '../src/core/build.js';
import { CacheManager } from '../src/core/cache.js';

const testDir = join(process.cwd(), '.test-build');

describe('BuildManager', () => {
  let buildManager: BuildManager;
  let cacheManager: CacheManager;
  let testRepoDir: string;

  beforeEach(() => {
    const cacheDir = join(testDir, 'cache');
    cacheManager = new CacheManager({ dir: cacheDir, git: true, deps: true });
    buildManager = new BuildManager(cacheManager);
    testRepoDir = join(testDir, 'repo');

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(testRepoDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('install', () => {
    it('should run install command in repo directory', async () => {
      writeFileSync(join(testRepoDir, 'package.json'), JSON.stringify({ name: 'test' }));

      await expect(
        buildManager.install(testRepoDir, 'https://example.com/test.git', 'echo installed')
      ).resolves.not.toThrow();
    });
  });

  describe('build', () => {
    it('should run build command in repo directory', async () => {
      await expect(
        buildManager.build(testRepoDir, 'echo built')
      ).resolves.not.toThrow();
    });
  });
});
