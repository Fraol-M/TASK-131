/**
 * Unit tests for catalogService scope filtering logic.
 * Tests isItemInScope() and maskSku() without database access.
 */
import { describe, it, expect } from 'vitest';
import { isItemInScope, maskSku } from '../../../src/modules/catalog/catalogService.js';
import type { UserScope } from '@nexusorder/shared-types';

describe('isItemInScope', () => {
  it('returns true when user has no scope dimensions (admin)', () => {
    const item = { eligibleScopes: [{ school: 'MIT', major: 'CS' }] };
    expect(isItemInScope(item, {})).toBe(true);
  });

  it('returns true when item has empty eligibleScopes (globally available)', () => {
    const item = { eligibleScopes: [] as UserScope[] };
    expect(isItemInScope(item, { school: 'ANY', major: 'ANY' })).toBe(true);
  });

  it('returns true when user scope matches an eligibleScopes entry', () => {
    const item = { eligibleScopes: [{ school: 'MIT', major: 'CS' }] };
    expect(isItemInScope(item, { school: 'MIT', major: 'CS' })).toBe(true);
  });

  it('returns false when user major does not match', () => {
    const item = { eligibleScopes: [{ school: 'MIT', major: 'EE' }] };
    expect(isItemInScope(item, { school: 'MIT', major: 'CS' })).toBe(false);
  });

  it('returns false when user school does not match', () => {
    const item = { eligibleScopes: [{ school: 'Stanford' }] };
    expect(isItemInScope(item, { school: 'MIT' })).toBe(false);
  });

  it('returns true when eligibleScopes entry has wildcard (missing field)', () => {
    // Entry only specifies school, not major — any major within that school matches
    const item = { eligibleScopes: [{ school: 'MIT' }] };
    expect(isItemInScope(item, { school: 'MIT', major: 'CS' })).toBe(true);
  });

  it('returns true if any eligibleScopes entry matches (OR logic)', () => {
    const item = { eligibleScopes: [{ school: 'MIT', major: 'EE' }, { school: 'MIT', major: 'CS' }] };
    expect(isItemInScope(item, { school: 'MIT', major: 'CS' })).toBe(true);
  });

  it('returns false when no eligibleScopes entries match', () => {
    const item = { eligibleScopes: [{ school: 'Stanford' }, { school: 'MIT', major: 'EE' }] };
    expect(isItemInScope(item, { school: 'MIT', major: 'CS' })).toBe(false);
  });

  it('handles class and cohort dimensions', () => {
    const item = { eligibleScopes: [{ school: 'MIT', class: '2025', cohort: 'A' }] };
    expect(isItemInScope(item, { school: 'MIT', class: '2025', cohort: 'A' })).toBe(true);
    expect(isItemInScope(item, { school: 'MIT', class: '2025', cohort: 'B' })).toBe(false);
  });
});

describe('maskSku', () => {
  it('masks a plain-text SKU to show only last 4 chars', () => {
    const masked = maskSku('ABC-12345');
    expect(masked).toContain('2345');
    expect(masked.length).toBeLessThan('ABC-12345'.length);
  });

  it('handles short SKU values', () => {
    const masked = maskSku('AB');
    expect(masked).toBeDefined();
    expect(typeof masked).toBe('string');
  });

  it('handles empty string', () => {
    const masked = maskSku('');
    expect(typeof masked).toBe('string');
  });
});
