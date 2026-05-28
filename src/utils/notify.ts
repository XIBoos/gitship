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
