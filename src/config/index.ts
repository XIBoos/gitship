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

    // Default locations in order of priority
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
