import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { CacheManager } from '../src/core/cache.js';

const testDir = join(process.cwd(), '.test-cache');

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({ dir: testDir, git: true, deps: true });
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getRepoCacheDir', () => {
    it('should generate consistent cache directory for same URL', () => {
      const url = 'https://gitea.example.com/group/project.git';
      const dir1 = cacheManager.getRepoCacheDir(url);
      const dir2 = cacheManager.getRepoCacheDir(url);

      expect(dir1).toBe(dir2);
      expect(dir1).toContain(testDir);
    });

    it('should generate different directories for different URLs', () => {
      const url1 = 'https://gitea.example.com/group/project-a.git';
      const url2 = 'https://gitea.example.com/group/project-b.git';

      const dir1 = cacheManager.getRepoCacheDir(url1);
      const dir2 = cacheManager.getRepoCacheDir(url2);

      expect(dir1).not.toBe(dir2);
    });
  });

  describe('needsReinstall', () => {
    it('should return true when no cached package-lock.json exists', () => {
      const repoDir = join(testDir, 'repo');
      mkdirSync(repoDir, { recursive: true });
      writeFileSync(join(repoDir, 'package-lock.json'), '{}');

      const result = cacheManager.needsReinstall(repoDir, 'https://example.com/test.git');

      expect(result).toBe(true);
    });

    it('should return false when package-lock.json unchanged', () => {
      const repoDir = join(testDir, 'repo');
      const cacheDir = cacheManager.getDepsCacheDir('https://example.com/test.git');
      mkdirSync(repoDir, { recursive: true });
      mkdirSync(cacheDir, { recursive: true });

      const lockContent = '{"name": "test", "version": "1.0.0"}';
      writeFileSync(join(repoDir, 'package-lock.json'), lockContent);
      writeFileSync(join(cacheDir, 'package-lock.json'), lockContent);

      const result = cacheManager.needsReinstall(repoDir, 'https://example.com/test.git');

      expect(result).toBe(false);
    });

    it('should return true when package-lock.json changed', () => {
      const repoDir = join(testDir, 'repo');
      const cacheDir = cacheManager.getDepsCacheDir('https://example.com/test.git');
      mkdirSync(repoDir, { recursive: true });
      mkdirSync(cacheDir, { recursive: true });

      writeFileSync(join(repoDir, 'package-lock.json'), '{"name": "test", "version": "2.0.0"}');
      writeFileSync(join(cacheDir, 'package-lock.json'), '{"name": "test", "version": "1.0.0"}');

      const result = cacheManager.needsReinstall(repoDir, 'https://example.com/test.git');

      expect(result).toBe(true);
    });
  });
});