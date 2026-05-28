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