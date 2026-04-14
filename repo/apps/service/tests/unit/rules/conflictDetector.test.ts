import { describe, it, expect } from 'vitest';
import { detectConflicts, detectCircularDependencies } from '../../../src/rules/conflictDetector.js';
import type { Rule } from '@nexusorder/shared-types';

function makeRule(overrides: Partial<Rule>): Rule {
  return {
    _id: 'r1', name: 'Test Rule', scope: {}, priority: 100,
    conditions: { logic: 'and', conditions: [] },
    actions: [],
    status: 'active',
    version: 1,
    createdBy: 'u1', updatedBy: 'u1',
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

describe('conflictDetector', () => {
  describe('detectConflicts', () => {
    it('detects priority clash for same priority + overlapping scope', () => {
      const rules = [
        makeRule({ _id: 'r1', name: 'Rule A', priority: 100 }),
        makeRule({ _id: 'r2', name: 'Rule B', priority: 100 }),
      ];
      const conflicts = detectConflicts(rules);
      expect(conflicts.some((c) => c.conflictType === 'priority_clash')).toBe(true);
    });

    it('returns no conflict when priorities differ and conditions differ', () => {
      const rules = [
        makeRule({ _id: 'r1', priority: 100, conditions: { logic: 'and', conditions: [{ field: 'state', operator: 'eq', value: 'submitted' }] } }),
        makeRule({ _id: 'r2', priority: 200, conditions: { logic: 'and', conditions: [{ field: 'state', operator: 'eq', value: 'approved' }] } }),
      ];
      const conflicts = detectConflicts(rules);
      expect(conflicts).toHaveLength(0);
    });

    it('ignores inactive rules', () => {
      const rules = [
        makeRule({ _id: 'r1', priority: 100, status: 'inactive' }),
        makeRule({ _id: 'r2', priority: 100 }),
      ];
      const conflicts = detectConflicts(rules);
      expect(conflicts).toHaveLength(0);
    });

    it('includes remediation suggestions with priority_clash', () => {
      const rules = [
        makeRule({ _id: 'r1', name: 'Rule A', priority: 100 }),
        makeRule({ _id: 'r2', name: 'Rule B', priority: 100 }),
      ];
      const conflicts = detectConflicts(rules);
      const clash = conflicts.find((c) => c.conflictType === 'priority_clash');
      expect(clash?.remediationSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('detectCircularDependencies', () => {
    it('detects a simple A→B→A cycle', () => {
      const rules = [
        makeRule({ _id: 'r1', actions: [{ type: 'apply_rule', parameters: { ruleId: 'r2' } }] }),
        makeRule({ _id: 'r2', actions: [{ type: 'apply_rule', parameters: { ruleId: 'r1' } }] }),
      ];
      const cycles = detectCircularDependencies(rules);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('returns no cycles when no dependencies exist', () => {
      const rules = [makeRule({ _id: 'r1' }), makeRule({ _id: 'r2' })];
      const cycles = detectCircularDependencies(rules);
      expect(cycles).toHaveLength(0);
    });
  });
});
