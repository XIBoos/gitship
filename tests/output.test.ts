import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputManager } from '../src/core/output.js';

const testDir = join(process.cwd(), '.test-output');

// rsync is only available in Docker/Linux environment
// On Windows, these tests will be skipped
const isRsyncAvailable = process.platform !== 'win32';

describe('OutputManager', () => {
  let outputManager: OutputManager;
  let sourceDir: string;
  let outputDir: string;

  beforeEach(() => {
    sourceDir = join(testDir, 'source');
    outputDir = join(testDir, 'output');
    outputManager = new OutputManager();

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('sync', () => {
    it.runIf(isRsyncAvailable)('should sync files to output directory', async () => {
      writeFileSync(join(sourceDir, 'index.html'), '<html></html>');
      writeFileSync(join(sourceDir, 'app.js'), 'console.log("test")');

      await outputManager.sync(sourceDir, outputDir, []);

      expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'app.js'))).toBe(true);
    });

    it.runIf(isRsyncAvailable)('should exclude files matching patterns', async () => {
      writeFileSync(join(sourceDir, 'index.html'), '<html></html>');
      writeFileSync(join(sourceDir, 'app.js.map'), '{"version":3}');

      await outputManager.sync(sourceDir, outputDir, ['*.map']);

      expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'app.js.map'))).toBe(false);
    });

    it.runIf(isRsyncAvailable)('should exclude multiple patterns', async () => {
      writeFileSync(join(sourceDir, 'index.html'), '<html></html>');
      writeFileSync(join(sourceDir, 'test.log'), 'log content');
      writeFileSync(join(sourceDir, 'app.js.map'), '{"version":3}');

      await outputManager.sync(sourceDir, outputDir, ['*.map', '*.log']);

      expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'test.log'))).toBe(false);
      expect(existsSync(join(outputDir, 'app.js.map'))).toBe(false);
    });
  });
});
