import { describe, it, expect } from 'vitest';
import { maskField } from '../../../src/crypto/maskField.js';

describe('maskField', () => {
  it('masks all but last 4 characters', () => {
    expect(maskField('1234567890')).toBe('******7890');
  });

  it('masks short value entirely when shorter than visible chars', () => {
    expect(maskField('abc')).toBe('***');
  });

  it('shows exactly 4 chars when length equals 4', () => {
    expect(maskField('1234')).toBe('1234');
  });

  it('returns empty string for empty input', () => {
    expect(maskField('')).toBe('');
  });

  it('respects custom visibleChars parameter', () => {
    expect(maskField('ABCDEFGH', 2)).toBe('******GH');
  });
});
