/**
 * serviceManager — spawns and supervises the bundled local Express service.
 *
 * Packaged (MSI) mode:
 *   Service lives at app.asar.unpacked/node_modules/@nexusorder/service/dist/server.js.
 *   serviceManager.start() spawns it as a child process and waits for the health endpoint.
 *
 * Dev mode (app.isPackaged === false):
 *   Service is managed externally (Docker / direct node).
 *   serviceManager.start() is a no-op: the health check in startupHealthCoordinator
 *   will catch an unreachable service and fail gracefully.
 */

import { app } from 'electron';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import path from 'path';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { localFetch, configureTrustAnchor } from './localFetch.js';
import { getOrCreateServiceEnv } from './productionConfig.js';

const log = createModuleLogger('serviceManager');

const SERVICE_PORT = process.env['SERVICE_PORT'] ?? '4433';
const SERVICE_URL = `https://127.0.0.1:${SERVICE_PORT}`;
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_INTERVAL_MS = 500;

let serviceProcess: ChildProcess | null = null;
// Populated after start() resolves; used by IPC handlers that need the internal key.
let internalApiKey = '';
// TLS cert path for the running service; used by index.ts for fingerprint pinning.
let tlsCertPath = '';

function getServiceEntryPoint(): string | null {
  if (!app.isPackaged) {
    return null; // managed externally in dev
  }
  return path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    '@nexusorder',
    'service',
    'dist',
    'server.js',
  );
}

export const serviceManager = {
  /**
   * Spawns the bundled service (MSI mode only).
   * Waits until the health endpoint responds OK or READY_TIMEOUT_MS elapses.
   * Throws if the service fails to start within the timeout.
   */
  async start(): Promise<void> {
    const entryPoint = getServiceEntryPoint();
    if (!entryPoint) {
      log.info('Dev mode: service managed externally — skipping spawn');
      return;
    }

    log.info({ entryPoint }, 'Spawning bundled service process');

    // Load (or generate on first run) all required production env vars —
    // encryption keys, TLS cert paths, session secret, internal API key.
    const serviceEnv = await getOrCreateServiceEnv(SERVICE_PORT);
    internalApiKey = serviceEnv.INTERNAL_API_KEY;
    tlsCertPath = serviceEnv.TLS_CERT_PATH;

    // Pin the local HTTPS agents to the generated cert — no more blanket rejectUnauthorized:false
    configureTrustAnchor(tlsCertPath);

    serviceProcess = spawn(process.execPath, [entryPoint], {
      env: {
        ...process.env,
        ...serviceEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    serviceProcess.stdout?.on('data', (chunk: Buffer) => {
      log.info({ src: 'svc' }, chunk.toString().trimEnd());
    });
    serviceProcess.stderr?.on('data', (chunk: Buffer) => {
      log.warn({ src: 'svc:err' }, chunk.toString().trimEnd());
    });
    serviceProcess.on('exit', (code, signal) => {
      log.warn({ code, signal }, 'Service process exited unexpectedly');
      serviceProcess = null;
    });
    serviceProcess.on('error', (err) => {
      log.error({ err }, 'Failed to spawn service process');
    });

    await this.waitForReady();
  },

  /**
   * Polls the service health endpoint until ready or timeout.
   * Used both during initial startup and after a restart.
   */
  async waitForReady(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const res = await localFetch(`${SERVICE_URL}/api/system/health`);
        if (res.ok) {
          log.info('Service health check passed — ready');
          return;
        }
      } catch {
        // not ready yet — keep polling
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, READY_POLL_INTERVAL_MS);
      });
    }
    throw new Error(`Service did not become ready within ${READY_TIMEOUT_MS}ms`);
  },

  /**
   * Gracefully terminates the service process.
   * Called from app before-quit handler.
   */
  stop(): void {
    if (serviceProcess) {
      log.info('Sending SIGTERM to service process');
      serviceProcess.kill('SIGTERM');
      serviceProcess = null;
    }
  },

  get isRunning(): boolean {
    return serviceProcess !== null;
  },

  /**
   * Returns the INTERNAL_API_KEY for the running service.
   * Only valid after start() has resolved.  Returns empty string in dev mode.
   */
  getInternalApiKey(): string {
    return internalApiKey || (process.env['INTERNAL_API_KEY'] ?? '');
  },

  /**
   * Returns the TLS cert path used by the running service.
   * Used by index.ts to pin the cert fingerprint in the certificate-error handler.
   * Returns empty string in dev mode.
   */
  getCertPath(): string {
    return tlsCertPath || (process.env['TLS_CERT_PATH'] ?? '');
  },
};
