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
