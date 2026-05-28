# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitShip is a Docker container tool for building and deploying frontend projects from Git repositories. It pulls code, installs dependencies, builds the project, and syncs output to a specified directory with caching support.

## Build Commands

```bash
npm run build      # Build with tsup (outputs to dist/)
npm run dev        # Build and watch for changes
npm run test       # Run all tests with vitest
npm run test:watch # Run tests in watch mode
npm run typecheck  # Type check without emitting
```

Running a single test:
```bash
npx vitest run tests/config.test.ts
```

## Architecture

```
src/
├── index.ts           # CLI entry point (commander)
├── types.ts           # TypeScript interfaces and DEFAULT_CONFIG
├── config/
│   ├── index.ts       # ConfigManager - loads YAML, applies defaults, merges env
│   ├── loader.ts      # YAML file loading
│   └── env.ts         # Environment variable overrides
├── core/
│   ├── git.ts         # GitManager - auth setup, clone/fetch, checkout
│   ├── build.ts       # BuildManager - install deps, run build command
│   ├── cache.ts       # CacheManager - repo/deps caching with MD5 hashing
│   └── output.ts      # OutputManager - rsync to output directory
├── modes/
│   ├── once.ts        # One-time execution (default)
│   ├── schedule.ts    # Cron-based scheduled execution
│   └── api.ts         # HTTP API server (hono)
└── utils/
    ├── exec.ts        # execa wrapper (exec, execStrict)
    ├── logger.ts      # Consola-based logging
    └── notify.ts      # Webhook notifications

config/
└── default.yaml       # Default configuration template
```

## Running Modes

1. **Once** (default): Single execution, exits with code 0 on success
2. **Schedule**: Runs on cron expression, container stays alive
3. **API**: Hono HTTP server with `/health`, `/deploy`, `/status` endpoints

## Key Patterns

- Config priority: `environment variables > YAML config > DEFAULT_CONFIG`
- Repo/deps directories are hashed using MD5 of repo URL (first 12 chars)
- Build output is discovered by checking: `dist`, `build`, `out`, `.output`, `public`
- `execStrict` throws on non-zero exit; `exec` returns result with exitCode
- Only successful builds sync to OUTPUT_DIR - failures preserve existing files

## Environment Variables

Config can be overridden with env vars matching the config path:
- `REPO_URL`, `REPO_BRANCH`, `REPO_VERSION`
- `BUILD_COMMAND`, `BUILD_INSTALL_COMMAND`
- `OUTPUT_DIR`, `CACHE_DIR`
- `GIT_TOKEN`, `GIT_USERNAME` (HTTPS auth)
- `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` (SSH auth)

See `.env.example` for full list.
