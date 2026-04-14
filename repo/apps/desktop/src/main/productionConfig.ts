/**
 * productionConfig — deterministic first-run bootstrap for the bundled service.
 *
 * On the first launch after MSI install, all required cryptographic keys and a
 * self-signed TLS certificate for localhost are generated and persisted to
 * `app.getPath('userData')`.  Subsequent launches load the persisted config, so
 * the database is accessible across restarts without re-provisioning.
 *
 * Secrets are stored at:
 *   %APPDATA%\NexusOrder Desk\nexusorder-service.json   (keys)
 *   %APPDATA%\NexusOrder Desk\tls\server.crt / server.key
 *
 * The config file should be protected by OS-level file permissions; on Windows
 * the %APPDATA% directory is user-scoped and not accessible by other accounts.
 */

import { app } from 'electron';
import { randomBytes } from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('productionConfig');

export interface ServiceEnv extends Record<string, string> {
  NODE_ENV: 'production';
  SERVICE_PORT: string;
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  FIELD_ENCRYPTION_KEY: string;
  BACKUP_ENCRYPTION_KEY: string;
  INTERNAL_API_KEY: string;
  SESSION_SECRET: string;
  TLS_CERT_PATH: string;
  TLS_KEY_PATH: string;
}

const CONFIG_FILENAME = 'nexusorder-service.json';

/**
 * Returns the full env block for spawning the bundled service.
 * Generates and persists all required values on the first call.
 */
export async function getOrCreateServiceEnv(servicePort: string): Promise<ServiceEnv> {
  const userDataDir = app.getPath('userData');
  const configPath = path.join(userDataDir, CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<ServiceEnv>;
      log.info({ configPath }, 'Loaded persisted service config');
      return mergeEnv(servicePort, saved);
    } catch (err) {
      log.warn({ err }, 'Failed to parse persisted config — regenerating');
    }
  }

  log.info('First run: generating production service configuration');

  // Generate self-signed TLS cert for localhost
  const tlsDir = path.join(userDataDir, 'tls');
  fs.mkdirSync(tlsDir, { recursive: true });
  const certPath = path.join(tlsDir, 'server.crt');
  const keyPath = path.join(tlsDir, 'server.key');
  generateSelfSignedCert(certPath, keyPath);

  const persistedConfig = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/nexusorder',
    MONGODB_DB_NAME: 'nexusorder',
    FIELD_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    INTERNAL_API_KEY: randomBytes(32).toString('hex'),
    SESSION_SECRET: randomBytes(64).toString('hex'),
    TLS_CERT_PATH: certPath,
    TLS_KEY_PATH: keyPath,
  };

  // Write with restrictive mode (ignored on Windows but signals intent)
  fs.writeFileSync(configPath, JSON.stringify(persistedConfig, null, 2), { mode: 0o600 });
  log.info({ configPath }, 'Production config generated and saved');

  return mergeEnv(servicePort, persistedConfig);
}

function mergeEnv(servicePort: string, saved: Partial<ServiceEnv>): ServiceEnv {
  return {
    NODE_ENV: 'production',
    SERVICE_PORT: servicePort,
    MONGODB_URI: saved.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/nexusorder',
    MONGODB_DB_NAME: saved.MONGODB_DB_NAME ?? 'nexusorder',
    FIELD_ENCRYPTION_KEY: saved.FIELD_ENCRYPTION_KEY ?? '',
    BACKUP_ENCRYPTION_KEY: saved.BACKUP_ENCRYPTION_KEY ?? '',
    INTERNAL_API_KEY: saved.INTERNAL_API_KEY ?? '',
    SESSION_SECRET: saved.SESSION_SECRET ?? '',
    TLS_CERT_PATH: saved.TLS_CERT_PATH ?? '',
    TLS_KEY_PATH: saved.TLS_KEY_PATH ?? '',
  };
}

/**
 * Resolves the OpenSSL binary path.
 * In the packaged MSI, openssl.exe is bundled as an extra resource in
 * process.resourcesPath (declared in electron-builder.yml extraResources).
 * In development, falls back to the system PATH.
 */
function resolveOpenSslBin(): string {
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'openssl.exe');
    if (fs.existsSync(bundled)) {
      return `"${bundled}"`;
    }
  }
  return 'openssl'; // development fallback — system PATH
}

/**
 * Generates a 10-year self-signed certificate for 127.0.0.1 / localhost using
 * the OpenSSL CLI.  In packaged mode the bundled openssl.exe is used (see
 * resolveOpenSslBin); in development the system OpenSSL from PATH is used.
 */
function generateSelfSignedCert(certPath: string, keyPath: string): void {
  const opensslBin = resolveOpenSslBin();
  try {
    execSync(
      `${opensslBin} req -x509 -newkey rsa:2048 ` +
      `-keyout "${keyPath}" -out "${certPath}" ` +
      `-days 3650 -nodes ` +
      `-subj "/CN=NexusOrder Local" ` +
      `-addext "subjectAltName=IP:127.0.0.1,DNS:localhost"`,
      { stdio: 'pipe' },
    );
    log.info({ certPath }, 'Self-signed TLS certificate generated');
  } catch (err) {
    throw new Error(
      `TLS certificate generation failed: ${(err as Error).message}. ` +
      `OpenSSL (included with Windows 11) is required on first run. ` +
      `Alternatively, provision certs manually at: ${certPath} and ${keyPath}`,
    );
  }
}
