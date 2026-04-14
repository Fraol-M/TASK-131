import { describe, it, expect } from 'vitest';
import { validatePassword } from '@nexusorder/shared-validation';

describe('passwordValidator', () => {
  it('accepts a valid password with number and symbol', () => {
    const result = validatePassword('SecurePass1!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects password shorter than 12 characters', () => {
    const result = validatePassword('Short1!');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('12'))).toBe(true);
  });

  it('rejects password without a number', () => {
    const result = validatePassword('NoNumbersHere!');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('number'))).toBe(true);
  });

  it('rejects password without a symbol', () => {
    const result = validatePassword('NoSymbolsHere1');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('symbol'))).toBe(true);
  });

  it('rejects empty password', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
  });

  it('accepts exactly 12 character password with number and symbol', () => {
    const result = validatePassword('Passw0rd!!!1');
    expect(result.valid).toBe(true);
  });
});
