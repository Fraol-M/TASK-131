import { createModuleLogger } from '@nexusorder/shared-logging';
import { localFetch } from './localFetch.js';

const log = createModuleLogger('recoveryBootstrap');

const RECOVERY_URL = `https://127.0.0.1:${process.env['SERVICE_PORT'] ?? '4433'}/api/system/health`;

/**
 * On startup, polls the service health endpoint until it responds or times out.
 * The actual crash recovery runs inside the Express service on startup;
 * the desktop only needs to wait until the service is ready.
 */
export const recoveryBootstrap = {
  async run(): Promise<void> {
    log.info('Recovery bootstrap: waiting for service readiness');
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      try {
        const resp = await localFetch(RECOVERY_URL);
        if (resp.ok) {
          log.info('Service is ready');
          return;
        }
      } catch {
        // Service not yet up — retry
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    log.warn('Service did not become ready within timeout — continuing to health check');
  },
};
