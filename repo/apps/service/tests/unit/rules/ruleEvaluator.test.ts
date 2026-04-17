/**
 * Unit tests for rule evaluator — condition evaluation logic.
 */
import { describe, it, expect } from 'vitest';
import { evaluateRule } from '../../../src/rules/ruleEvaluator.js';
import type { Rule } from '@nexusorder/shared-types';

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    _id: 'test-rule',
    name: 'Test',
    scope: {},
    priority: 1,
    conditions: { logic: 'and', conditions: [{ field: 'total', operator: 'gte', value: 100 }] },
    actions: [{ type: 'flag', parameters: {} }],
    status: 'active',
    version: 1,
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Rule;
}

describe('evaluateRule', () => {
  it('returns false for inactive rules', () => {
    const rule = makeRule({ status: 'inactive' });
    expect(evaluateRule(rule, { total: 500 })).toBe(false);
  });

  it('returns false for draft rules', () => {
    const rule = makeRule({ status: 'draft' });
    expect(evaluateRule(rule, { total: 500 })).toBe(false);
  });

  it('evaluates gte condition correctly', () => {
    const rule = makeRule();
    expect(evaluateRule(rule, { total: 100 })).toBe(true);
    expect(evaluateRule(rule, { total: 99 })).toBe(false);
  });

  it('evaluates eq condition', () => {
    const rule = makeRule({
      conditions: { logic: 'and', conditions: [{ field: 'state', operator: 'eq', value: 'submitted' }] },
    });
    expect(evaluateRule(rule, { state: 'submitted' })).toBe(true);
    expect(evaluateRule(rule, { state: 'paid' })).toBe(false);
  });

  it('evaluates neq condition', () => {
    const rule = makeRule({
      conditions: { logic: 'and', conditions: [{ field: 'state', operator: 'neq', value: 'cancelled' }] },
    });
    expect(evaluateRule(rule, { state: 'submitted' })).toBe(true);
    expect(evaluateRule(rule, { state: 'cancelled' })).toBe(false);
  });

  it('evaluates in condition', () => {
    const rule = makeRule({
      conditions: { logic: 'and', conditions: [{ field: 'currency', operator: 'in', value: ['CNY', 'USD'] }] },
    });
    expect(evaluateRule(rule, { currency: 'CNY' })).toBe(true);
    expect(evaluateRule(rule, { currency: 'EUR' })).toBe(false);
  });

  it('evaluates contains condition on strings', () => {
    const rule = makeRule({
      conditions: { logic: 'and', conditions: [{ field: 'name', operator: 'contains', value: 'Pro' }] },
    });
    expect(evaluateRule(rule, { name: 'MacBook Pro' })).toBe(true);
    expect(evaluateRule(rule, { name: 'iPad Air' })).toBe(false);
  });

  it('evaluates is_null condition', () => {
    const rule = makeRule({
      conditions: { logic: 'and', conditions: [{ field: 'notes', operator: 'is_null' }] },
    });
    expect(evaluateRule(rule, { notes: undefined })).toBe(true);
    expect(evaluateRule(rule, { notes: 'has content' })).toBe(false);
  });

  it('evaluates OR group', () => {
    const rule = makeRule({
      conditions: {
        logic: 'or',
        conditions: [
          { field: 'total', operator: 'gte', value: 1000 },
          { field: 'currency', operator: 'eq', value: 'USD' },
        ],
      },
    });
    expect(evaluateRule(rule, { total: 50, currency: 'USD' })).toBe(true);
    expect(evaluateRule(rule, { total: 2000, currency: 'CNY' })).toBe(true);
    expect(evaluateRule(rule, { total: 50, currency: 'CNY' })).toBe(false);
  });

  it('evaluates nested condition groups', () => {
    const rule = makeRule({
      conditions: {
        logic: 'and',
        conditions: [
          { field: 'total', operator: 'gte', value: 100 },
          { logic: 'or', conditions: [
            { field: 'currency', operator: 'eq', value: 'USD' },
            { field: 'currency', operator: 'eq', value: 'CNY' },
          ] },
        ],
      },
    });
    expect(evaluateRule(rule, { total: 200, currency: 'CNY' })).toBe(true);
    expect(evaluateRule(rule, { total: 200, currency: 'EUR' })).toBe(false);
    expect(evaluateRule(rule, { total: 50, currency: 'CNY' })).toBe(false);
  });

  it('evaluates nested field access (dot notation)', () => {
    const rule = makeRule({
      conditions: { logic: 'and', conditions: [{ field: 'user.role', operator: 'eq', value: 'admin' }] },
    });
    expect(evaluateRule(rule, { user: { role: 'admin' } })).toBe(true);
    expect(evaluateRule(rule, { user: { role: 'student' } })).toBe(false);
  });
});
