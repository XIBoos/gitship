# Web Deploy Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker container tool that clones frontend projects from Gitea, builds them, and deploys to a host directory.

**Architecture:** Node.js CLI tool written in TypeScript, bundled with tsup. Core managers handle Git operations, caching, building, and output sync. Three execution modes: once, schedule, and API server.

**Tech Stack:** Node.js 18, TypeScript, execa, js-yaml, commander, hono, node-cron, rsync

---

## File Structure

```
web-deploy-helper/
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsup.config.ts
├── .gitignore
├── Dockerfile
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types.ts              # 类型定义
│   ├── config/
│   │   ├── index.ts          # ConfigManager
│   │   ├── loader.ts         # YAML 加载
│   │   └── env.ts            # 环境变量覆盖
│   ├── core/
│   │   ├── git.ts            # GitManager
│   │   ├── build.ts          # BuildManager
│   │   ├── cache.ts          # CacheManager
│   │   └── output.ts         # OutputManager
│   ├── modes/
│   │   ├── once.ts           # 一次性执行
│   │   ├── schedule.ts       # 定时任务
│   │   └── api.ts            # API 服务
│   └── utils/
│       ├── notify.ts          # NotifyManager
│       ├── logger.ts          # 日志
│       └── exec.ts            # 命令执行封装
├── config/
│   └── default.yaml          # 默认配置
└── tests/
    ├── config.test.ts
    ├── git.test.ts
    ├── cache.test.ts
    ├── build.test.ts
    ├── output.test.ts
    └── notify.test.ts
```

---

### Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "web-deploy-helper",
  "version": "1.0.0",
  "description": "Docker container for building and deploying frontend projects",
  "type": "module",
  "main": "dist/deploy.js",
  "bin": {
    "deploy-helper": "dist/deploy.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "execa": "^9.0.0",
    "hono": "^4.0.0",
    "js-yaml": "^4.1.0",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "@types/node-cron": "^3.0.11",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  minify: false,
  sourcemap: true,
  dts: true,
  outDir: 'dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.log
.env
.DS_Store
coverage/
.cache/
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: dependencies installed successfully

- [ ] **Step 6: Commit**

```bash
git init
git add package.json package-lock.json tsconfig.json tsup.config.ts .gitignore
git commit -m "chore: initialize project with TypeScript and build config"
```

---

### Task 2: TypeScript Type Definitions

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

```typescript
export interface RepoConfig {
  url: string;
  branch: string;
  version?: string;
}

export interface BuildConfig {
  command: string;
  install_command: string;
  node_version?: string;
}

export interface OutputConfig {
  dir: string;
  exclude: string[];
}

export interface CacheConfig {
  dir: string;
  git: boolean;
  deps: boolean;
}

export interface ErrorConfig {
  on_error: 'stop' | 'notify';
  webhook?: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  cron: string;
}

export interface ApiConfig {
  enabled: boolean;
  port: number;
}

export interface DeployConfig {
  repo: RepoConfig;
  build: BuildConfig;
  output: OutputConfig;
  cache: CacheConfig;
  error: ErrorConfig;
  schedule: ScheduleConfig;
  api: ApiConfig;
}

export interface AuthConfig {
  username?: string;
  token?: string;
  ssh_private_key?: string;
  ssh_known_hosts?: string;
}

export interface DeployResult {
  success: boolean;
  commitHash?: string;
  error?: string;
  stage?: 'git' | 'install' | 'build' | 'sync';
  timestamp: string;
}

export interface NotifyPayload {
  event: 'deploy_success' | 'deploy_failed';
  repo: string;
  branch: string;
  version?: string;
  stage?: string;
  error?: string;
  timestamp: string;
}

export const DEFAULT_CONFIG: DeployConfig = {
  repo: {
    url: '',
    branch: 'main',
    version: undefined,
  },
  build: {
    command: 'npm run build',
    install_command: 'npm install',
    node_version: undefined,
  },
  output: {
    dir: '/output',
    exclude: ['*.map', '*.log', '.git', 'node_modules'],
  },
  cache: {
    dir: '/cache',
    git: true,
    deps: true,
  },
  error: {
    on_error: 'stop',
    webhook: undefined,
  },
  schedule: {
    enabled: false,
    cron: '',
  },
  api: {
    enabled: false,
    port: 3000,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 3: Default Configuration File

**Files:**
- Create: `config/default.yaml`

- [ ] **Step 1: Create config/default.yaml**

```yaml
repo:
  url: ""
  branch: "main"
  version: ""

build:
  command: "npm run build"
  install_command: "npm install"
  node_version: ""

output:
  dir: "/output"
  exclude:
    - "*.map"
    - "*.log"
    - ".git"
    - "node_modules"

cache:
  dir: "/cache"
  git: true
  deps: true

error:
  on_error: "stop"
  webhook: ""

schedule:
  enabled: false
  cron: ""

api:
  enabled: false
  port: 3000
```

- [ ] **Step 2: Commit**

```bash
git add config/default.yaml
git commit -m "feat: add default configuration file"
```

---

### Task 4: Logger Utility

**Files:**
- Create: `src/utils/logger.ts`

- [ ] **Step 1: Create src/utils/logger.ts**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(level: LogLevel = 'info', prefix: string = 'deploy') {
    this.level = level;
    this.prefix = prefix;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private formatMessage(level: LogLevel, message: string, data?: object): string {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${message}`;
    if (data) {
      return `${base} ${JSON.stringify(data)}`;
    }
    return base;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(message: string, data?: object): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: object): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: object): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: object): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);
export { Logger };
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/logger.ts
git commit -m "feat: add logger utility"
```

---

### Task 5: Configuration Loader

**Files:**
- Create: `src/config/loader.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing test for YAML loading**

Create `tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { loadYamlConfig } from '../src/config/loader.js';
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

      expect(result.repo.url).toBe('https://gitea.example.com/group/project.git');
      expect(result.repo.branch).toBe('develop');
      expect(result.repo.version).toBe('v1.0.0');
      expect(result.build.command).toBe('npm run build:prod');
      expect(result.output.dir).toBe('/data/dist');
      expect(result.output.exclude).toContain('*.map');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/config/loader.js'

- [ ] **Step 3: Create src/config/loader.ts**

```typescript
import { readFileSync, existsSync } from 'fs';
import { load } from 'js-yaml';
import type { DeployConfig } from '../types.js';
import { logger } from '../utils/logger.js';

export function loadYamlConfig(configPath: string): DeployConfig | null {
  if (!existsSync(configPath)) {
    logger.debug(`Config file not found: ${configPath}`);
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = load(content) as DeployConfig;
    logger.info(`Loaded config from: ${configPath}`);
    return config;
  } catch (error) {
    logger.error(`Failed to parse config file: ${configPath}`, { error });
    throw new Error(`Invalid YAML in config file: ${configPath}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/loader.ts tests/config.test.ts
git commit -m "feat: add YAML config loader with tests"
```

---

### Task 6: Environment Variable Override

**Files:**
- Create: `src/config/env.ts`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Add failing tests for env override**

Add to `tests/config.test.ts`:

```typescript
import { mergeWithEnv } from '../src/config/env.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/config/env.js'

- [ ] **Step 3: Create src/config/env.ts**

```typescript
import type { DeployConfig } from '../types.js';
import { logger } from '../utils/logger.js';

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

function parseArray(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value.split(':').filter(Boolean);
}

export function mergeWithEnv(config: DeployConfig): DeployConfig {
  const result = { ...config };

  // Repo config
  if (process.env.REPO_URL) {
    result.repo = { ...result.repo, url: process.env.REPO_URL };
    logger.debug('Overrode repo.url from env');
  }
  if (process.env.REPO_BRANCH) {
    result.repo = { ...result.repo, branch: process.env.REPO_BRANCH };
    logger.debug('Overrode repo.branch from env');
  }
  if (process.env.REPO_VERSION) {
    result.repo = { ...result.repo, version: process.env.REPO_VERSION };
    logger.debug('Overrode repo.version from env');
  }

  // Build config
  if (process.env.BUILD_COMMAND) {
    result.build = { ...result.build, command: process.env.BUILD_COMMAND };
    logger.debug('Overrode build.command from env');
  }
  if (process.env.BUILD_INSTALL_COMMAND) {
    result.build = { ...result.build, install_command: process.env.BUILD_INSTALL_COMMAND };
    logger.debug('Overrode build.install_command from env');
  }
  if (process.env.BUILD_NODE_VERSION) {
    result.build = { ...result.build, node_version: process.env.BUILD_NODE_VERSION };
    logger.debug('Overrode build.node_version from env');
  }

  // Output config
  if (process.env.OUTPUT_DIR) {
    result.output = { ...result.output, dir: process.env.OUTPUT_DIR };
    logger.debug('Overrode output.dir from env');
  }
  const excludeArray = parseArray(process.env.OUTPUT_EXCLUDE);
  if (excludeArray) {
    result.output = { ...result.output, exclude: excludeArray };
    logger.debug('Overrode output.exclude from env');
  }

  // Cache config
  if (process.env.CACHE_DIR) {
    result.cache = { ...result.cache, dir: process.env.CACHE_DIR };
    logger.debug('Overrode cache.dir from env');
  }
  const cacheGit = parseBoolean(process.env.CACHE_GIT);
  if (cacheGit !== undefined) {
    result.cache = { ...result.cache, git: cacheGit };
    logger.debug('Overrode cache.git from env');
  }
  const cacheDeps = parseBoolean(process.env.CACHE_DEPS);
  if (cacheDeps !== undefined) {
    result.cache = { ...result.cache, deps: cacheDeps };
    logger.debug('Overrode cache.deps from env');
  }

  // Error config
  if (process.env.ERROR_ON_ERROR) {
    const onError = process.env.ERROR_ON_ERROR as 'stop' | 'notify';
    result.error = { ...result.error, on_error: onError };
    logger.debug('Overrode error.on_error from env');
  }
  if (process.env.ERROR_WEBHOOK) {
    result.error = { ...result.error, webhook: process.env.ERROR_WEBHOOK };
    logger.debug('Overrode error.webhook from env');
  }

  // Schedule config
  const scheduleEnabled = parseBoolean(process.env.SCHEDULE_ENABLED);
  if (scheduleEnabled !== undefined) {
    result.schedule = { ...result.schedule, enabled: scheduleEnabled };
    logger.debug('Overrode schedule.enabled from env');
  }
  if (process.env.SCHEDULE_CRON) {
    result.schedule = { ...result.schedule, cron: process.env.SCHEDULE_CRON };
    logger.debug('Overrode schedule.cron from env');
  }

  // API config
  const apiEnabled = parseBoolean(process.env.API_ENABLED);
  if (apiEnabled !== undefined) {
    result.api = { ...result.api, enabled: apiEnabled };
    logger.debug('Overrode api.enabled from env');
  }
  const apiPort = parseNumber(process.env.API_PORT);
  if (apiPort !== undefined) {
    result.api = { ...result.api, port: apiPort };
    logger.debug('Overrode api.port from env');
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts tests/config.test.ts
git commit -m "feat: add environment variable override with tests"
```

---

### Task 7: ConfigManager Integration

**Files:**
- Create: `src/config/index.ts`

- [ ] **Step 1: Create src/config/index.ts**

```typescript
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import type { DeployConfig } from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';
import { loadYamlConfig } from './loader.js';
import { mergeWithEnv } from './env.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ConfigManager {
  private configPath?: string;

  constructor(configPath?: string) {
    this.configPath = configPath;
  }

  load(): DeployConfig {
    let config: Partial<DeployConfig> = {};

    // Try to load from specified path or default locations
    const configPaths = this.getConfigPaths();

    for (const path of configPaths) {
      if (existsSync(path)) {
        const loaded = loadYamlConfig(path);
        if (loaded) {
          config = loaded;
          logger.info(`Using config from: ${path}`);
          break;
        }
      }
    }

    // Apply defaults
    const withDefaults = this.applyDefaults(config);

    // Override with environment variables
    const finalConfig = mergeWithEnv(withDefaults);

    this.validate(finalConfig);

    return finalConfig;
  }

  private getConfigPaths(): string[] {
    const paths: string[] = [];

    if (this.configPath) {
      paths.push(this.configPath);
    }

    // Default locations
    paths.push('/config/deploy.yaml');
    paths.push(join(process.cwd(), 'deploy-config.yaml'));
    paths.push(join(__dirname, '../../config/default.yaml'));

    return paths;
  }

  private applyDefaults(config: Partial<DeployConfig>): DeployConfig {
    return {
      repo: { ...DEFAULT_CONFIG.repo, ...config.repo },
      build: { ...DEFAULT_CONFIG.build, ...config.build },
      output: { ...DEFAULT_CONFIG.output, ...config.output },
      cache: { ...DEFAULT_CONFIG.cache, ...config.cache },
      error: { ...DEFAULT_CONFIG.error, ...config.error },
      schedule: { ...DEFAULT_CONFIG.schedule, ...config.schedule },
      api: { ...DEFAULT_CONFIG.api, ...config.api },
    };
  }

  private validate(config: DeployConfig): void {
    if (!config.repo.url) {
      throw new Error('repo.url is required');
    }

    if (config.schedule.enabled && !config.schedule.cron) {
      throw new Error('schedule.cron is required when schedule.enabled is true');
    }

    if (config.api.enabled && (config.api.port < 1 || config.api.port > 65535)) {
      throw new Error('api.port must be between 1 and 65535');
    }

    logger.debug('Config validation passed');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/config/index.ts
git commit -m "feat: add ConfigManager integration"
```

---

### Task 8: Command Execution Utility

**Files:**
- Create: `src/utils/exec.ts`

- [ ] **Step 1: Create src/utils/exec.ts**

```typescript
import { execa } from 'execa';
import { logger } from './logger.js';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  silent?: boolean;
}

export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { cwd, env, timeout = 300000, silent = false } = options;

  if (!silent) {
    logger.debug(`Executing: ${command} ${args.join(' ')}`, { cwd });
  }

  try {
    const result = await execa(command, args, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      reject: false,
      all: true,
    });

    if (!silent) {
      logger.debug(`Command completed with exit code: ${result.exitCode}`);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    logger.error(`Command failed: ${command}`, { error });
    throw error;
  }
}

export async function execStrict(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<string> {
  const result = await exec(command, args, options);

  if (result.exitCode !== 0) {
    throw new Error(
      `Command '${command} ${args.join(' ')}' failed with exit code ${result.exitCode}: ${result.stderr}`
    );
  }

  return result.stdout;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/exec.ts
git commit -m "feat: add command execution utility"
```

---

### Task 9: Cache Manager

**Files:**
- Create: `src/core/cache.ts`
- Create: `tests/cache.test.ts`

- [ ] **Step 1: Write failing tests for CacheManager**

Create `tests/cache.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/core/cache.js'

- [ ] **Step 3: Create src/core/cache.ts**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/cache.ts tests/cache.test.ts
git commit -m "feat: add CacheManager with tests"
```

---

### Task 10: Git Manager

**Files:**
- Create: `src/core/git.ts`
- Create: `tests/git.test.ts`

- [ ] **Step 1: Write failing tests for GitManager**

Create `tests/git.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
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
      // Create a minimal git repo
      await exec('git', ['init'], { cwd: testRepoDir });
      expect(gitManager.isRepoCached(testRepoDir)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/core/git.js'

- [ ] **Step 3: Create src/core/git.ts**

```typescript
import { existsSync } from 'fs';
import { join } from 'path';
import { exec, execStrict } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import type { AuthConfig } from '../types.js';
import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
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

    // Disable strict host key checking if no known_hosts provided
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
    // Configure git credential helper
    await execStrict('git', ['config', '--global', 'credential.helper', 'store']);
    
    // Write credentials
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
    // Clone from local mirror to work directory
    if (!existsSync(workDir)) {
      mkdirSync(workDir, { recursive: true });
    }

    await execStrict('git', ['clone', repoDir, workDir]);

    // Checkout specific ref
    const refArg = this.isCommitHash(ref) ? ref : `origin/${ref}`;
    await execStrict('git', ['checkout', refArg], { cwd: workDir });

    // Get current commit hash
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/git.ts tests/git.test.ts
git commit -m "feat: add GitManager with tests"
```

---

### Task 11: Build Manager

**Files:**
- Create: `src/core/build.ts`
- Create: `tests/build.test.ts`

- [ ] **Step 1: Write failing tests for BuildManager**

Create `tests/build.test.ts`:

```typescript
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
      // Create minimal package.json
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/core/build.js'

- [ ] **Step 3: Create src/core/build.ts**

```typescript
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

    // Check if we need to reinstall
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

    // Cache the node_modules
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
      // Remove old cache if exists
      if (existsSync(destNodeModules)) {
        // Can't easily remove, just overwrite
      }
      cpSync(srcNodeModules, destNodeModules, { recursive: true });
      logger.debug('node_modules cached');
    }
  }

  private linkOrCopyNodeModules(src: string, dest: string): void {
    try {
      // Try symlink first (faster)
      symlinkSync(src, dest, 'junction');
      logger.debug('node_modules symlinked');
    } catch {
      // Fall back to copy if symlink fails
      cpSync(src, dest, { recursive: true });
      logger.debug('node_modules copied');
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/build.ts tests/build.test.ts
git commit -m "feat: add BuildManager with tests"
```

---

### Task 12: Output Manager

**Files:**
- Create: `src/core/output.ts`
- Create: `tests/output.test.ts`

- [ ] **Step 1: Write failing tests for OutputManager**

Create `tests/output.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { OutputManager } from '../src/core/output.js';

const testDir = join(process.cwd(), '.test-output');

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
    it('should sync files to output directory', async () => {
      writeFileSync(join(sourceDir, 'index.html'), '<html></html>');
      writeFileSync(join(sourceDir, 'app.js'), 'console.log("test")');

      await outputManager.sync(sourceDir, outputDir, []);

      expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'app.js'))).toBe(true);
    });

    it('should exclude files matching patterns', async () => {
      writeFileSync(join(sourceDir, 'index.html'), '<html></html>');
      writeFileSync(join(sourceDir, 'app.js.map'), '{"version":3}');

      await outputManager.sync(sourceDir, outputDir, ['*.map']);

      expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'app.js.map'))).toBe(false);
    });

    it('should exclude multiple patterns', async () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/core/output.js'

- [ ] **Step 3: Create src/core/output.ts**

```typescript
import { join } from 'path';
import { execStrict } from '../utils/exec.js';
import { logger } from '../utils/logger.js';

export class OutputManager {
  async sync(
    sourceDir: string,
    outputDir: string,
    excludes: string[]
  ): Promise<void> {
    logger.info(`Syncing output from ${sourceDir} to ${outputDir}`);

    // Build rsync exclude arguments
    const excludeArgs = excludes.flatMap((pattern) => ['--exclude', pattern]);

    // Use rsync for efficient sync
    // -a: archive mode (preserve permissions, times, etc.)
    // --delete: remove files in destination that don't exist in source
    // --prune-empty-dirs: remove empty directories
    const args = [
      '-a',
      '--delete',
      '--prune-empty-dirs',
      ...excludeArgs,
      `${sourceDir}/`,
      outputDir,
    ];

    await execStrict('rsync', args);

    logger.info('Output sync completed');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/output.ts tests/output.test.ts
git commit -m "feat: add OutputManager with tests"
```

---

### Task 13: Notify Manager

**Files:**
- Create: `src/utils/notify.ts`
- Create: `tests/notify.test.ts`

- [ ] **Step 1: Write failing tests for NotifyManager**

Create `tests/notify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { NotifyManager } from '../src/utils/notify.js';
import type { NotifyPayload } from '../src/types.js';

describe('NotifyManager', () => {
  describe('formatPayload', () => {
    it('should format success payload correctly', () => {
      const manager = new NotifyManager();
      const payload: NotifyPayload = {
        event: 'deploy_success',
        repo: 'https://example.com/test.git',
        branch: 'main',
        version: 'v1.0.0',
        timestamp: '2026-05-28T10:00:00Z',
      };

      const result = manager.formatPayload(payload);

      expect(result.event).toBe('deploy_success');
      expect(result.repo).toBe('https://example.com/test.git');
      expect(result.branch).toBe('main');
      expect(result.version).toBe('v1.0.0');
    });

    it('should format failure payload with error', () => {
      const manager = new NotifyManager();
      const payload: NotifyPayload = {
        event: 'deploy_failed',
        repo: 'https://example.com/test.git',
        branch: 'main',
        stage: 'build',
        error: 'npm run build failed',
        timestamp: '2026-05-28T10:00:00Z',
      };

      const result = manager.formatPayload(payload);

      expect(result.event).toBe('deploy_failed');
      expect(result.stage).toBe('build');
      expect(result.error).toBe('npm run build failed');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - Cannot find module '../src/utils/notify.js'

- [ ] **Step 3: Create src/utils/notify.ts**

```typescript
import { logger } from './logger.js';
import type { NotifyPayload } from '../types.js';

export class NotifyManager {
  async send(webhookUrl: string, payload: NotifyPayload): Promise<void> {
    if (!webhookUrl) {
      logger.warn('No webhook URL configured, skipping notification');
      return;
    }

    const formattedPayload = this.formatPayload(payload);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedPayload),
      });

      if (!response.ok) {
        logger.error(`Webhook notification failed: ${response.status}`, {
          status: response.status,
        });
      } else {
        logger.info('Webhook notification sent successfully');
      }
    } catch (error) {
      logger.error('Failed to send webhook notification', { error });
    }
  }

  formatPayload(payload: NotifyPayload): Record<string, unknown> {
    return {
      event: payload.event,
      repo: payload.repo,
      branch: payload.branch,
      version: payload.version,
      stage: payload.stage,
      error: payload.error,
      timestamp: payload.timestamp,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/notify.ts tests/notify.test.ts
git commit -m "feat: add NotifyManager with tests"
```

---

### Task 14: Once Mode Runner

**Files:**
- Create: `src/modes/once.ts`

- [ ] **Step 1: Create src/modes/once.ts**

```typescript
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import type { DeployConfig, AuthConfig, DeployResult } from '../types.js';
import { ConfigManager } from '../config/index.js';
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

    // Step 4: Install dependencies
    logger.info('Installing dependencies...');
    await buildManager.install(workDir, config.repo.url, config.build.install_command);

    // Step 5: Build
    logger.info('Building project...');
    await buildManager.build(workDir, config.build.command);

    // Step 6: Determine build output directory
    const buildOutputDir = await findBuildOutput(workDir);

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

async function findBuildOutput(workDir: string): Promise<string> {
  // Common build output directories
  const possibleDirs = ['dist', 'build', 'out', '.output', 'public'];

  for (const dir of possibleDirs) {
    const path = join(workDir, dir);
    if (existsSync(path)) {
      return path;
    }
  }

  // If no standard output directory, use work directory itself
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
```

- [ ] **Step 2: Commit**

```bash
git add src/modes/once.ts
git commit -m "feat: add once mode runner"
```

---

### Task 15: Schedule Mode Runner

**Files:**
- Create: `src/modes/schedule.ts`

- [ ] **Step 1: Create src/modes/schedule.ts**

```typescript
import cron from 'node-cron';
import type { DeployConfig, AuthConfig, DeployResult } from '../types.js';
import { runOnce } from './once.js';
import { logger } from '../utils/logger.js';

export async function runSchedule(
  config: DeployConfig,
  auth: AuthConfig
): Promise<void> {
  const cronExpression = config.schedule.cron;

  if (!cronExpression) {
    throw new Error('schedule.cron is required for schedule mode');
  }

  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  logger.info(`Starting schedule mode with cron: ${cronExpression}`);

  // Run immediately on start
  logger.info('Running initial deployment...');
  await runOnce(config, auth);

  // Schedule subsequent runs
  const task = cron.schedule(cronExpression, async () => {
    logger.info('Scheduled deployment triggered');
    try {
      await runOnce(config, auth);
    } catch (error) {
      logger.error('Scheduled deployment failed', { error });
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, stopping scheduled task');
    task.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, stopping scheduled task');
    task.stop();
    process.exit(0);
  });

  // Keep the process alive
  logger.info('Schedule mode running, press Ctrl+C to stop');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modes/schedule.ts
git commit -m "feat: add schedule mode runner"
```

---

### Task 16: API Mode Runner

**Files:**
- Create: `src/modes/api.ts`

- [ ] **Step 1: Create src/modes/api.ts**

```typescript
import { Hono } from 'hono';
import type { DeployConfig, AuthConfig, DeployResult } from '../types.js';
import { runOnce } from './once.js';
import { logger } from '../utils/logger.js';

let lastResult: DeployResult | null = null;
let isDeploying = false;

export async function runApi(
  config: DeployConfig,
  auth: AuthConfig
): Promise<void> {
  const app = new Hono();
  const port = config.api.port;

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Trigger deployment
  app.post('/deploy', async (c) => {
    if (isDeploying) {
      return c.json(
        { error: 'Deployment already in progress' },
        409
      );
    }

    isDeploying = true;
    logger.info('API triggered deployment');

    try {
      const result = await runOnce(config, auth);
      lastResult = result;
      return c.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json(
        { error: errorMessage },
        500
      );
    } finally {
      isDeploying = false;
    }
  });

  // Get last deployment status
  app.get('/status', (c) => {
    return c.json({
      deploying: isDeploying,
      lastResult,
    });
  });

  logger.info(`Starting API server on port ${port}`);

  // Use Bun or Node built-in server
  const server = Bun?.serve
    ? Bun.serve({ port, fetch: app.fetch })
    : serveWithHttp(app, port);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, stopping API server');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, stopping API server');
    process.exit(0);
  });

  logger.info(`API mode running on port ${port}`);
}

// Fallback for non-Bun environments
function serveWithHttp(app: Hono, port: number) {
  const { createServer } = require('http');
  const server = createServer(app.fetch);
  server.listen(port);
  return server;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modes/api.ts
git commit -m "feat: add API mode runner"
```

---

### Task 17: CLI Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create src/index.ts**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { ConfigManager } from './config/index.js';
import { runOnce } from './modes/once.js';
import { runSchedule } from './modes/schedule.js';
import { runApi } from './modes/api.js';
import { logger } from './utils/logger.js';
import type { AuthConfig } from './types.js';

const program = new Command();

program
  .name('deploy-helper')
  .description('Docker container for building and deploying frontend projects')
  .version('1.0.0');

program
  .option('-c, --config <path>', 'Path to config file', '/config/deploy.yaml')
  .option('--once', 'Run once and exit (default)', false)
  .option('--schedule <cron>', 'Run on schedule (cron expression)')
  .option('--api', 'Run as API server', false)
  .option('--port <port>', 'API server port', '3000')
  .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info');

program.parse();

const options = program.opts();

async function main(): Promise<void> {
  try {
    // Set log level
    logger.setLevel(options.logLevel);

    // Load configuration
    logger.info('Loading configuration...');
    const configManager = new ConfigManager(options.config);
    const config = configManager.load();

    // Build auth config from environment
    const auth: AuthConfig = {
      username: process.env.GIT_USERNAME,
      token: process.env.GIT_TOKEN,
      ssh_private_key: process.env.SSH_PRIVATE_KEY,
      ssh_known_hosts: process.env.SSH_KNOWN_HOSTS,
    };

    // Determine mode
    const scheduleMode = options.schedule || config.schedule.enabled;
    const apiMode = options.api || config.api.enabled;

    if (scheduleMode) {
      const cronExpr = options.schedule || config.schedule.cron;
      config.schedule.cron = cronExpr;
      config.schedule.enabled = true;
      await runSchedule(config, auth);
    } else if (apiMode) {
      const port = parseInt(options.port) || config.api.port;
      config.api.port = port;
      config.api.enabled = true;
      await runApi(config, auth);
    } else {
      // Default: once mode
      const result = await runOnce(config, auth);
      process.exit(result.success ? 0 : 1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Fatal error', { error: message });
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point"
```

---

### Task 18: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    rsync \
    curl \
    openssh-client \
    bash

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Create necessary directories
RUN mkdir -p /cache/repos /cache/deps /cache/work /output /config

# Set permissions
RUN chmod +x /app/dist/deploy.js

# Default entrypoint
ENTRYPOINT ["node", "/app/dist/deploy.js"]
CMD ["--once"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile with multi-stage build"
```

---

### Task 19: Build and Test

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: All tests pass

- [ ] **Step 2: Build the project**

Run: `npm run build`

Expected: Build succeeds, dist/deploy.js created

- [ ] **Step 3: Type check**

Run: `npm run typecheck`

Expected: No type errors

- [ ] **Step 4: Build Docker image**

Run: `docker build -t web-deploy-helper .`

Expected: Image builds successfully

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final build verification"
```

---

## Summary

Total: 19 tasks covering:
- Project initialization (Task 1)
- Type definitions (Task 2)
- Default configuration (Task 3)
- Utilities: logger, exec, notify (Tasks 4, 8, 13)
- Core modules: config, cache, git, build, output (Tasks 5-7, 9-12)
- Execution modes: once, schedule, API (Tasks 14-16)
- CLI entry point (Task 17)
- Dockerfile (Task 18)
- Final verification (Task 19)
