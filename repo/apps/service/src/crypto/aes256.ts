import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte AES key from any key material string.
 * SHA-256 produces exactly 32 bytes from any input, making this safe for
 * both valid hex keys and arbitrary ASCII dev/test key strings.
 */
function deriveKey(keyMaterial: string): Buffer {
  return createHash('sha256').update(keyMaterial, 'utf8').digest();
}

function getKey(): Buffer {
  return deriveKey(config.encryption.fieldKey);
}

function getBackupKey(): Buffer {
  return deriveKey(config.backup.encryptionKey);
}

/**
 * Encrypt a raw Buffer with AES-256-GCM using the backup key.
 * Wire format: [4-byte IV length][IV][4-byte authTag length][authTag][ciphertext]
 */
export function encryptBuffer(plainBuffer: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getBackupKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const header = Buffer.alloc(8);
  header.writeUInt32BE(iv.length, 0);
  header.writeUInt32BE(AUTH_TAG_LENGTH, 4);
  return Buffer.concat([header, iv, authTag, encrypted]);
}

/**
 * Decrypt a Buffer produced by encryptBuffer().
 */
export function decryptBuffer(encryptedBuffer: Buffer): Buffer {
  let offset = 0;
  const ivLen = encryptedBuffer.readUInt32BE(offset); offset += 4;
  const tagLen = encryptedBuffer.readUInt32BE(offset); offset += 4;
  const iv = encryptedBuffer.subarray(offset, offset + ivLen); offset += ivLen;
  const authTag = encryptedBuffer.subarray(offset, offset + tagLen); offset += tagLen;
  const data = encryptedBuffer.subarray(offset);
  const decipher = createDecipheriv(ALGORITHM, getBackupKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Encrypt a UTF-8 string with AES-256-GCM.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypt a field encrypted by encryptField().
 */
export function decryptField(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
