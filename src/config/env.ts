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
  if (process.env.REPO_SUBDIRECTORY) {
    result.repo = { ...result.repo, subdirectory: process.env.REPO_SUBDIRECTORY };
    logger.debug('Overrode repo.subdirectory from env');
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
