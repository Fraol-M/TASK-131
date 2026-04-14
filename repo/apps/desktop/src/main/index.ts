import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { X509Certificate } from 'crypto';
import { appLifecycleManager } from './appLifecycleManager.js';
import { recoveryBootstrap } from './recoveryBootstrap.js';
import { startupHealthCoordinator } from './startupHealthCoordinator.js';
import { updateImportManager } from './updateImportManager.js';
import { serviceManager } from './serviceManager.js';
import { mongoManager } from './mongoManager.js';
import { localFetch } from './localFetch.js';

/**
 * Fingerprint of the service's TLS cert.
 * Set after serviceManager.start() in main() so the renderer's Chromium network
 * stack accepts only the specific cert we generated — not any localhost cert.
 * Null in dev mode (app.isPackaged === false): any localhost self-signed cert is accepted.
 * In packaged mode, null means fingerprint loading failed — cert errors are REJECTED (fail closed).
 */
let serviceCertFingerprint: string | null = null;

function loadServiceCertFingerprint(certPath: string): void {
  try {
    const pem = fs.readFileSync(certPath, 'utf8');
    const cert = new X509Certificate(pem);
    // Electron uses the format "SHA256/XX:XX:..." for certificate.fingerprint
    serviceCertFingerprint = `SHA256/${cert.fingerprint256}`;
  } catch {
    // Dev mode or cert not yet generated — leave null; any localhost cert accepted
  }
}

// Only allow the renderer's Chromium to connect to 127.0.0.1 / localhost.
// In packaged mode the cert fingerprint is pinned after serviceManager starts.
app.on('certificate-error', (event, _webContents, url, _error, certificate, callback) => {
  if (url.startsWith('https://127.0.0.1') || url.startsWith('https://localhost')) {
    if (serviceCertFingerprint !== null && certificate.fingerprint === serviceCertFingerprint) {
      // Exact fingerprint match — accept
      event.preventDefault();
      callback(true);
    } else if (serviceCertFingerprint === null && !app.isPackaged) {
      // Dev mode only: no pinned fingerprint, accept any localhost cert
      event.preventDefault();
      callback(true);
    } else {
      // Packaged mode with missing fingerprint, or fingerprint mismatch — reject (fail closed)
      callback(false);
    }
  } else {
    callback(false);
  }
});

// NOTE: NODE_TLS_REJECT_UNAUTHORIZED is NOT set globally.
// Main-process HTTPS calls to localhost use localFetch() with a CA-pinned agent
// (configured via configureTrustAnchor after serviceManager loads the cert).

const SERVICE_URL = `https://127.0.0.1:${process.env['SERVICE_PORT'] ?? '4433'}`;

/**
 * Attempts rollback via the service API first (service has DB access to record the event).
 * Falls back to a local symlink swap if the service is unreachable.
 */
async function triggerAutoRollback(): Promise<void> {
  try {
    await localFetch(`${SERVICE_URL}/api/updates/auto-rollback`, {
      method: 'POST',
      headers: { 'x-internal-key': serviceManager.getInternalApiKey(), 'x-actor-id': 'internal:desktop:health-check' },
      body: JSON.stringify({}),
    });
    console.error('[main] Auto-rollback requested via service API');
  } catch (err) {
    console.error('[main] Service API unreachable for rollback — attempting local fallback:', err);
    await tryLocalFallbackRollback();
  }
}

/**
 * Desktop-side rollback that does not require the service to be reachable.
 * Swaps `builds/current` → `builds/previous` symlinks directly on disk.
 * This mirrors the logic in rollbackOrchestrator but runs in the Electron main process.
 * No DB event is written (the service is unavailable), but the swap is logged to stderr.
 */
async function tryLocalFallbackRollback(): Promise<void> {
  const buildsDir = process.env['BUILDS_DIR'] ?? path.join(process.cwd(), 'builds');
  const currentLink = path.join(buildsDir, 'current');
  const previousLink = path.join(buildsDir, 'previous');

  try {
    if (!fs.existsSync(previousLink)) {
      console.error('[main] Local fallback rollback: no previous build found — manual recovery required');
      return;
    }
    const previousTarget = fs.readlinkSync(previousLink);
    if (fs.existsSync(currentLink)) {
      const currentTarget = fs.readlinkSync(currentLink);
      fs.unlinkSync(currentLink);
      fs.symlinkSync(previousTarget, currentLink);
      fs.unlinkSync(previousLink);
      fs.symlinkSync(currentTarget, previousLink);
      console.error('[main] Local fallback rollback complete — swapped current → previous build');
    }
  } catch (err) {
    console.error('[main] Local fallback rollback failed:', err);
  }
}

async function main(): Promise<void> {
  // 1. Spawn the bundled MongoDB process (no-op in dev mode where Docker manages it)
  try {
    await mongoManager.start();
  } catch (err) {
    console.error('[main] MongoDB failed to start:', err);
    app.quit();
    return;
  }

  // 2. Spawn the bundled service process (no-op in dev mode where service runs externally)
  try {
    await serviceManager.start();
  } catch (err) {
    console.error('[main] Service failed to start:', err);
    mongoManager.stop();
    app.quit();
    return;
  }

  // Pin the TLS cert fingerprint for the renderer's Chromium network stack
  loadServiceCertFingerprint(serviceManager.getCertPath());

  // Shut down service and database when app quits
  app.on('before-quit', () => {
    serviceManager.stop();
    mongoManager.stop();
  });

  // 3. Run startup recovery scan (before window open)
  await recoveryBootstrap.run();

  // 4. Health check — fail-closed: if service is unreachable, treat as unhealthy
  const healthy = await startupHealthCoordinator.check();
  if (!healthy) {
    console.error('[main] Startup health check failed — requesting auto-rollback');
    await triggerAutoRollback();
    app.quit();
    return;
  }

  // 5. Register update IPC handlers before windows open
  updateImportManager.initialize();

  // 6. Launch app windows
  appLifecycleManager.initialize();
}

app.whenReady().then(main).catch((err) => {
  console.error('[main] Fatal error during startup:', err);
  app.quit();
});
