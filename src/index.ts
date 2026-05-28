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
  .name('gitship')
  .description('Ship your frontend from Git to production')
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
      token: process.env.GIT_TOKEN || process.env.GIT_PASSWORD,
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
