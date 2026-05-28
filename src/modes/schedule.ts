import cron from 'node-cron';
import type { DeployConfig, AuthConfig } from '../types.js';
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