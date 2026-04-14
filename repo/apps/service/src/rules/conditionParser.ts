import type { Condition, ConditionGroup } from '@nexusorder/shared-types';

/**
 * Normalized condition graph node — the internal representation used by
 * the conflict detector to compare two rules' conditions.
 */
export interface ConditionNode {
  field: string;
  operator: string;
  value: unknown;
}

/**
 * Flatten a ConditionGroup tree into a deduplicated list of leaf conditions.
 * Used by conflictDetector to determine whether two rules share overlapping
 * conditions (or have no conditions at all, meaning they match everything).
 */
export function flattenConditions(group: ConditionGroup): ConditionNode[] {
  const nodes: ConditionNode[] = [];

  for (const item of group.conditions) {
    if ('conditions' in item) {
      // Nested ConditionGroup — recurse
      nodes.push(...flattenConditions(item as ConditionGroup));
    } else {
      const c = item as Condition;
      nodes.push({ field: c.field, operator: c.operator, value: c.value });
    }
  }

  return nodes;
}

/**
 * Returns true when there is at least one shared (field, operator) pair between
 * two condition sets — interpreted as "potentially overlapping".
 * Two empty condition sets always overlap (both match everything).
 */
export function conditionsOverlap(a: ConditionGroup, b: ConditionGroup): boolean {
  const nodesA = flattenConditions(a);
  const nodesB = flattenConditions(b);

  // Both empty → match everything → they overlap
  if (nodesA.length === 0 || nodesB.length === 0) return true;

  for (const na of nodesA) {
    for (const nb of nodesB) {
      if (na.field === nb.field && na.operator === nb.operator) return true;
    }
  }

  return false;
}
