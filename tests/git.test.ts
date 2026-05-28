import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { GitManager } from '../src/core/git.js';
import { exec } from '../src/utils/exec.js';

const testDir = join(process.cwd(), '.test-git');

describe('GitManager', () => {
  let gitManager: GitManager;
  let testRepoDir: string;

  beforeEach(async () => {
    gitManager = new GitManager();
    testRepoDir = join(testDir, 'test-repo');

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

  describe('isRepoCached', () => {
    it('should return false for non-existent directory', () => {
      expect(gitManager.isRepoCached('/non/existent/path')).toBe(false);
    });

    it('should return false for directory without .git', () => {
      mkdirSync(join(testDir, 'no-git'), { recursive: true });
      expect(gitManager.isRepoCached(join(testDir, 'no-git'))).toBe(false);
    });

    it('should return true for valid git repository', async () => {
      mkdirSync(testRepoDir, { recursive: true });
      await exec('git', ['init'], { cwd: testRepoDir });
      expect(gitManager.isRepoCached(testRepoDir)).toBe(true);
    });
  });
});