import { config as loadDotenv } from 'dotenv';
import path from 'path';

// Load .env from repo root in development
if (process.env['NODE_ENV'] !== 'production') {
  loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });
}

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  nodeEnv: (process.env['NODE_ENV'] ?? 'development') as 'development' | 'test' | 'production',

  service: {
    port: parseInt(process.env['SERVICE_PORT'] ?? '4433', 10),
    host: process.env['SERVICE_HOST'] ?? '127.0.0.1',
  },

  mongodb: {
    uri: requireEnv('MONGODB_URI', 'mongodb://localhost:27017/nexusorder'),
    dbName: requireEnv('MONGODB_DB_NAME', 'nexusorder'),
  },

  tls: {
    certPath: process.env['TLS_CERT_PATH'] ?? '',
    keyPath: process.env['TLS_KEY_PATH'] ?? '',
    enabled: !!(process.env['TLS_CERT_PATH'] && process.env['TLS_KEY_PATH']),
  },

  session: {
    secret: requireEnv('SESSION_SECRET'),  // No fallback — service must not start without an explicit secret
    ttlSeconds: parseInt(process.env['SESSION_TTL_SECONDS'] ?? '28800', 10),
  },

  encryption: {
    // No fallback — service must not start without an explicit key
    fieldKey: requireEnv('FIELD_ENCRYPTION_KEY'),
  },

  reconciliation: {
    merchantPublicKeyPath: process.env['WECHAT_MERCHANT_PUBLIC_KEY_PATH'] ?? '',
  },

  backup: {
    destinationPath: process.env['BACKUP_DESTINATION_PATH'] ?? './backups',
    retentionDays: parseInt(process.env['BACKUP_RETENTION_DAYS'] ?? '30', 10),
    scheduleCron: process.env['BACKUP_SCHEDULE_CRON'] ?? '0 2 * * *',
    // No fallback — service must not start without an explicit key
    encryptionKey: requireEnv('BACKUP_ENCRYPTION_KEY'),
  },

  checkout: {
    maxAttempts: parseInt(process.env['CHECKOUT_MAX_ATTEMPTS'] ?? '10', 10),
    windowMinutes: parseInt(process.env['CHECKOUT_WINDOW_MINUTES'] ?? '10', 10),
  },

  order: {
    autoCancelMinutes: parseInt(process.env['ORDER_AUTO_CANCEL_MINUTES'] ?? '30', 10),
    autoCloseDays: parseInt(process.env['ORDER_AUTO_CLOSE_DAYS'] ?? '14', 10),
  },

  auth: {
    maxFailedAttempts: parseInt(process.env['AUTH_MAX_FAILED_ATTEMPTS'] ?? '5', 10),
    lockoutMinutes: parseInt(process.env['AUTH_LOCKOUT_MINUTES'] ?? '15', 10),
  },

  internal: {
    // Pre-shared key for Electron main-process → service calls that cannot carry a browser session cookie.
    // No fallback — service must not start without an explicit key.
    apiKey: requireEnv('INTERNAL_API_KEY'),
  },
} as const;
