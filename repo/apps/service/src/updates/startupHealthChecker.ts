import { getDb } from '../persistence/mongoClient.js';
import { config } from '../config/index.js';
import type { HealthStatus } from '@nexusorder/shared-types';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('startupHealthChecker');

export async function runStartupHealthCheck(): Promise<HealthStatus> {
  const version = process.env['npm_package_version'] ?? '1.0.0';
  let dbOk = false;

  try {
    await getDb().command({ ping: 1 });
    dbOk = true;
  } catch (err) {
    log.error({ err }, 'Health check: database ping failed');
  }

  const pendingCheckpoints = await getDb()
    .collection('checkpoint_logs')
    .countDocuments({ status: 'pending' });

  const status: HealthStatus = {
    status: dbOk ? (pendingCheckpoints > 0 ? 'degraded' : 'ok') : 'unhealthy',
    service: true,
    database: dbOk,
    tls: config.tls.enabled,
    checkpointRecoveryPending: pendingCheckpoints > 0,
    version,
    checkedAt: new Date(),
  };

  log.info(status, 'Startup health check complete');
  return status;
}
