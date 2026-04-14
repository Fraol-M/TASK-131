// Mask a string showing only the last N characters.
// Used for payment references and sensitive identifiers in grids.
export function maskField(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return '*'.repeat(value.length);
  const masked = '*'.repeat(value.length - visibleChars);
  return masked + value.slice(-visibleChars);
}

// Redact known sensitive keys from an arbitrary object before logging
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'token', 'secret',
  'paymentReferenceEncrypted', 'rawSignature', 'fieldEncryptionKey',
]);

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.has(k) ? '[REDACTED]' : v,
    ]),
  );
}
