import { pino } from 'pino';

// Sensitive fields that must never appear in logs
const REDACTED_FIELDS = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'sessionSecret',
  'fieldEncryptionKey',
  'paymentReferenceEncrypted',
  'rawSignature',
];

const isDev = process.env['NODE_ENV'] === 'development';

const loggerOptions = {
  level: process.env['LOG_LEVEL'] ?? (isDev ? 'debug' : 'info'),
  redact: {
    paths: REDACTED_FIELDS,
    censor: '[REDACTED]',
  },
  ...(isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } }
    : {}),
};

export const logger = pino(loggerOptions);

export function createModuleLogger(module: string) {
  return logger.child({ module });
}
