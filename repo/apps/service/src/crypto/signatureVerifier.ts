import forge from 'node-forge';
import fs from 'fs';
import { config } from '../config/index.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('signatureVerifier');

let cachedPublicKey: forge.pki.rsa.PublicKey | null = null;

function loadPublicKey(): forge.pki.rsa.PublicKey {
  if (cachedPublicKey) return cachedPublicKey;

  const keyPath = config.reconciliation.merchantPublicKeyPath;
  if (!keyPath) throw new Error('WECHAT_MERCHANT_PUBLIC_KEY_PATH is not configured');

  const pem = fs.readFileSync(keyPath, 'utf-8');
  cachedPublicKey = forge.pki.publicKeyFromPem(pem) as forge.pki.rsa.PublicKey;
  log.info({ keyPath }, 'Merchant public key loaded');
  return cachedPublicKey;
}

/**
 * Verify a row-level RSA signature from a WeChat Pay reconciliation CSV.
 * The payload is the canonical string representation of the row fields.
 * The signature is Base64-encoded.
 */
export function verifyRowSignature(payload: string, signatureBase64: string): boolean {
  try {
    const publicKey = loadPublicKey();
    const md = forge.md.sha256.create();
    md.update(payload, 'utf8');
    const signatureBytes = forge.util.decode64(signatureBase64);
    return publicKey.verify(md.digest().bytes(), signatureBytes);
  } catch (err) {
    log.warn({ err }, 'Signature verification failed');
    return false;
  }
}

// For testing: allow injecting a test public key
export function _resetPublicKeyCache(): void {
  cachedPublicKey = null;
}
