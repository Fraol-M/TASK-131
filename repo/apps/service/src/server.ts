import http from 'http';
import https from 'https';
import fs from 'fs';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './persistence/mongoClient.js';
import { runIndexes } from './persistence/runIndexes.js';
import { startAllJobs } from './jobs/jobScheduler.js';
import { runStartupRecovery } from './recovery/recoveryScanner.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('server');

async function bootstrap(): Promise<void> {
  log.info({ env: config.nodeEnv }, 'Starting NexusOrder service');

  // 0. Hard gate — refuse to start without TLS outside dev/test
  if (!config.tls.enabled && config.nodeEnv !== 'development' && config.nodeEnv !== 'test') {
    throw new Error(
      'TLS must be enabled outside development/test modes. ' +
      'Set TLS_CERT_PATH and TLS_KEY_PATH environment variables before starting.',
    );
  }

  // 1. Database
  await connectDatabase();
  await runIndexes();

  // 2. Crash recovery — must run before accepting traffic
  await runStartupRecovery();

  // 3. Express app
  const app = createApp();

  // 4. HTTP/HTTPS server
  let server: http.Server | https.Server;
  if (config.tls.enabled) {
    const tlsOptions = {
      cert: fs.readFileSync(config.tls.certPath),
      key: fs.readFileSync(config.tls.keyPath),
    };
    server = https.createServer(tlsOptions, app);
    log.info('TLS enabled — starting HTTPS server');
  } else if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
    server = http.createServer(app);
    log.warn('TLS disabled — using plain HTTP (dev/test only)');
  } else {
    throw new Error('Plain HTTP is only permitted in development/test modes.');
  }

  server.listen(config.service.port, config.service.host, () => {
    log.info(
      { port: config.service.port, host: config.service.host },
      'NexusOrder service listening',
    );
  });

  // 5. Background jobs (after server is up)
  startAllJobs();

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Graceful shutdown initiated');
    server.close(async () => {
      const { disconnectDatabase } = await import('./persistence/mongoClient.js');
      const { stopAllJobs } = await import('./jobs/jobScheduler.js');
      stopAllJobs();
      await disconnectDatabase();
      log.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
