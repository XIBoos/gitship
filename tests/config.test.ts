import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { loadYamlConfig } from '../src/config/loader.js';
import { mergeWithEnv } from '../src/config/env.js';
import type { DeployConfig } from '../src/types.js';

const testDir = join(process.cwd(), '.test-config');

describe('ConfigLoader', () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadYamlConfig', () => {
    it('should load a valid YAML config file', () => {
      const configPath = join(testDir, 'valid.yaml');
      const yamlContent = `
repo:
  url: "https://gitea.example.com/group/project.git"
  branch: "develop"
  version: "v1.0.0"
build:
  command: "npm run build:prod"
  install_command: "npm ci"
output:
  dir: "/data/dist"
  exclude:
    - "*.map"
cache:
  dir: "/data/cache"
  git: true
  deps: true
error:
  on_error: "notify"
  webhook: "https://example.com/webhook"
schedule:
  enabled: false
  cron: ""
api:
  enabled: false
  port: 3000
`;
      writeFileSync(configPath, yamlContent);

      const result = loadYamlConfig(configPath);

      expect(result!.repo.url).toBe('https://gitea.example.com/group/project.git');
      expect(result!.repo.branch).toBe('develop');
      expect(result!.repo.version).toBe('v1.0.0');
      expect(result!.build.command).toBe('npm run build:prod');
      expect(result!.output.dir).toBe('/data/dist');
      expect(result!.output.exclude).toContain('*.map');
    });

    it('should return null for non-existent file', () => {
      const result = loadYamlConfig('/non/existent/path.yaml');
      expect(result).toBeNull();
    });

    it('should throw for invalid YAML', () => {
      const configPath = join(testDir, 'invalid.yaml');
      writeFileSync(configPath, 'invalid: yaml: content: [');

      expect(() => loadYamlConfig(configPath)).toThrow();
    });
  });
});

describe('mergeWithEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should override repo.url with REPO_URL', () => {
    process.env.REPO_URL = 'https://override.example.com/repo.git';
    const config: DeployConfig = {
      repo: { url: 'https://original.example.com/repo.git', branch: 'main' },
      build: { command: 'npm run build', install_command: 'npm install' },
      output: { dir: '/output', exclude: [] },
      cache: { dir: '/cache', git: true, deps: true },
      error: { on_error: 'stop' },
      schedule: { enabled: false, cron: '' },
      api: { enabled: false, port: 3000 },
    };

    const result = mergeWithEnv(config);

    expect(result.repo.url).toBe('https://override.example.com/repo.git');
  });

  it('should override output.exclude with OUTPUT_EXCLUDE (colon separated)', () => {
    process.env.OUTPUT_EXCLUDE = '*.map:*.log:test/';
    const config: DeployConfig = {
      repo: { url: '', branch: 'main' },
      build: { command: 'npm run build', install_command: 'npm install' },
      output: { dir: '/output', exclude: ['original'] },
      cache: { dir: '/cache', git: true, deps: true },
      error: { on_error: 'stop' },
      schedule: { enabled: false, cron: '' },
      api: { enabled: false, port: 3000 },
    };

    const result = mergeWithEnv(config);

    expect(result.output.exclude).toEqual(['*.map', '*.log', 'test/']);
  });

  it('should parse boolean env vars correctly', () => {
    process.env.CACHE_GIT = 'false';
    process.env.CACHE_DEPS = 'true';
    const config: DeployConfig = {
      repo: { url: '', branch: 'main' },
      build: { command: 'npm run build', install_command: 'npm install' },
      output: { dir: '/output', exclude: [] },
      cache: { dir: '/cache', git: true, deps: false },
      error: { on_error: 'stop' },
      schedule: { enabled: false, cron: '' },
      api: { enabled: false, port: 3000 },
    };

    const result = mergeWithEnv(config);

    expect(result.cache.git).toBe(false);
    expect(result.cache.deps).toBe(true);
  });

  it('should parse numeric env vars correctly', () => {
    process.env.API_PORT = '8080';
    const config: DeployConfig = {
      repo: { url: '', branch: 'main' },
      build: { command: 'npm run build', install_command: 'npm install' },
      output: { dir: '/output', exclude: [] },
      cache: { dir: '/cache', git: true, deps: true },
      error: { on_error: 'stop' },
      schedule: { enabled: false, cron: '' },
      api: { enabled: false, port: 3000 },
    };

    const result = mergeWithEnv(config);

    expect(result.api.port).toBe(8080);
  });

  it('should not override if env var is not set', () => {
    delete process.env.REPO_BRANCH;
    const config: DeployConfig = {
      repo: { url: '', branch: 'develop' },
      build: { command: 'npm run build', install_command: 'npm install' },
      output: { dir: '/output', exclude: [] },
      cache: { dir: '/cache', git: true, deps: true },
      error: { on_error: 'stop' },
      schedule: { enabled: false, cron: '' },
      api: { enabled: false, port: 3000 },
    };

    const result = mergeWithEnv(config);

    expect(result.repo.branch).toBe('develop');
  });
});
