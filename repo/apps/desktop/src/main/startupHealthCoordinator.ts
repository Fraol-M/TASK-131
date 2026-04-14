import { createModuleLogger } from '@nexusorder/shared-logging';
import { localFetch } from './localFetch.js';

const log = createModuleLogger('startupHealthCoordinator');

const SERVICE_HEALTH_URL = `https://127.0.0.1:${process.env['SERVICE_PORT'] ?? '4433'}/api/system/health`;

export const startupHealthCoordinator = {
  async check(): Promise<boolean> {
    try {
      const response = await localFetch(SERVICE_HEALTH_URL);
      const body = await response.json<{ data?: { status: string } }>();

      if (body.data?.status === 'unhealthy') {
        log.error({ health: body.data }, 'Service health check: UNHEALTHY');
        return false;
      }

      log.info({ health: body.data }, 'Service health check: OK');
      return true;
    } catch (err) {
      // Fail-closed: an unreachable service is treated as unhealthy.
      // recoveryBootstrap.run() already waited up to 10 s for the service to start,
      // so if it is still unreachable here the update may have broken the service.
      log.error({ err }, 'Service health check: unreachable — treating as unhealthy (fail-closed)');
      return false;
    }
  },
};
