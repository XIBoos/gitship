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

  // Use @hono/node-server for proper Node.js integration
  const { serve } = await import('@hono/node-server');

  serve({
    fetch: app.fetch,
    port,
  }, () => {
    logger.info(`API mode running on port ${port}`);
  });
}