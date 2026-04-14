import type { Rule, RuleConflict, RemediationSuggestion } from '@nexusorder/shared-types';
import { remediationSuggester } from './remediationSuggester.js';

/**
 * Detect conflicts between active rules.
 * Returns conflict objects with remediation suggestions.
 */
export function detectConflicts(rules: Rule[]): Omit<RuleConflict, '_id' | 'detectedAt'>[] {
  const activeRules = rules.filter((r) => r.status === 'active');
  const conflicts: Omit<RuleConflict, '_id' | 'detectedAt'>[] = [];

  for (let i = 0; i < activeRules.length; i++) {
    for (let j = i + 1; j < activeRules.length; j++) {
      const a = activeRules[i]!;
      const b = activeRules[j]!;

      // Overlapping scope + same priority = conflict
      if (a.priority === b.priority && scopesOverlap(a, b)) {
        const suggestions = remediationSuggester.suggest('priority_clash', a, b);
        conflicts.push({
          ruleIds: [a._id, b._id],
          conflictType: 'priority_clash',
          description: `Rules "${a.name}" and "${b.name}" have the same priority (${a.priority}) and overlapping scopes`,
          remediationSuggestions: suggestions,
        });
      }

      // Both rules active but one could override the other in same scope
      if (scopesOverlap(a, b) && a.priority !== b.priority) {
        // This is expected precedence — not a conflict unless conditions are identical
        if (conditionsAreIdentical(a, b)) {
          const suggestions = remediationSuggester.suggest('overlapping_scope', a, b);
          conflicts.push({
            ruleIds: [a._id, b._id],
            conflictType: 'overlapping_scope',
            description: `Rules "${a.name}" and "${b.name}" have identical conditions and overlapping scopes`,
            remediationSuggestions: suggestions,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect circular dependencies between rules (graph DFS).
 * A circular dependency exists when rule A depends on rule B which depends back on A.
 */
export function detectCircularDependencies(rules: Rule[]): string[][] {
  // Build adjacency list from rule actions that reference other rules
  const adj = new Map<string, string[]>();
  for (const rule of rules) {
    const deps: string[] = [];
    for (const action of rule.actions) {
      if (action.type === 'apply_rule' && typeof action.parameters['ruleId'] === 'string') {
        deps.push(action.parameters['ruleId']);
      }
    }
    adj.set(rule._id, deps);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const path = new Set<string>();
  const stack: string[] = [];

  function dfs(nodeId: string): void {
    if (path.has(nodeId)) {
      // Found a cycle — extract it
      const cycleStart = stack.indexOf(nodeId);
      if (cycleStart !== -1) cycles.push([...stack.slice(cycleStart), nodeId]);
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    path.add(nodeId);
    stack.push(nodeId);

    for (const neighbor of adj.get(nodeId) ?? []) {
      dfs(neighbor);
    }

    path.delete(nodeId);
    stack.pop();
  }

  for (const rule of rules) {
    dfs(rule._id);
  }

  return cycles;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scopesOverlap(a: Rule, b: Rule): boolean {
  // Empty scope = global; global overlaps with everything
  const aEmpty = !a.scope.school && !a.scope.major && !a.scope.class && !a.scope.cohort;
  const bEmpty = !b.scope.school && !b.scope.major && !b.scope.class && !b.scope.cohort;
  if (aEmpty || bEmpty) return true;

  // Two scopes overlap if none of their specified fields are disjoint
  if (a.scope.school && b.scope.school && a.scope.school !== b.scope.school) return false;
  if (a.scope.major && b.scope.major && a.scope.major !== b.scope.major) return false;
  if (a.scope.class && b.scope.class && a.scope.class !== b.scope.class) return false;
  if (a.scope.cohort && b.scope.cohort && a.scope.cohort !== b.scope.cohort) return false;
  return true;
}

function conditionsAreIdentical(a: Rule, b: Rule): boolean {
  return JSON.stringify(a.conditions) === JSON.stringify(b.conditions);
}
