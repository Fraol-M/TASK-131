import { describe, it, expect, beforeEach } from 'vitest';
import { encryptField, decryptField } from '../../../src/crypto/aes256.js';

// Set test encryption key before importing
process.env['FIELD_ENCRYPTION_KEY'] = 'a'.repeat(64);

describe('aes256', () => {
  it('encrypts and decrypts a string correctly', () => {
    const plaintext = 'PAYMENT-REF-12345';
    const encrypted = encryptField(plaintext);
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const c1 = encryptField(plaintext);
    const c2 = encryptField(plaintext);
    expect(c1).not.toBe(c2);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptField('test-value');
    const tampered = encrypted.replace(/.$/, encrypted.endsWith('a') ? 'b' : 'a');
    expect(() => decryptField(tampered)).toThrow();
  });
});
