/**
 * Mask a sensitive string — show only the last 4 characters.
 * Used in API responses for payment references and identifiers in grids.
 */
export function maskField(value: string, visibleChars = 4): string {
  if (!value) return '';
  if (value.length <= visibleChars) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}
