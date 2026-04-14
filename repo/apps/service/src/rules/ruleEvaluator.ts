import type { Rule, ConditionGroup, Condition } from '@nexusorder/shared-types';

/**
 * Evaluate whether a rule matches a given context object (e.g. an order document).
 * Conditions are evaluated recursively using the AST structure.
 */
export function evaluateRule(rule: Rule, context: Record<string, unknown>): boolean {
  if (rule.status !== 'active') return false;

  // Time window check
  if (rule.timeWindow) {
    if (!isWithinTimeWindow(rule.timeWindow, new Date())) return false;
  }

  return evaluateConditionGroup(rule.conditions, context);
}

function evaluateConditionGroup(group: ConditionGroup, context: Record<string, unknown>): boolean {
  const results = group.conditions.map((c) => {
    if ('logic' in c) {
      return evaluateConditionGroup(c as ConditionGroup, context);
    }
    return evaluateSingleCondition(c as Condition, context);
  });

  return group.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
}

function getNestedValue(context: Record<string, unknown>, field: string): unknown {
  return field.split('.').reduce<unknown>((obj, key) => {
    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

function evaluateSingleCondition(condition: Condition, context: Record<string, unknown>): boolean {
  const value = getNestedValue(context, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq': return value === expected;
    case 'neq': return value !== expected;
    case 'gt': return typeof value === 'number' && typeof expected === 'number' && value > expected;
    case 'gte': return typeof value === 'number' && typeof expected === 'number' && value >= expected;
    case 'lt': return typeof value === 'number' && typeof expected === 'number' && value < expected;
    case 'lte': return typeof value === 'number' && typeof expected === 'number' && value <= expected;
    case 'in': return Array.isArray(expected) && expected.includes(value);
    case 'not_in': return Array.isArray(expected) && !expected.includes(value);
    case 'contains': return typeof value === 'string' && typeof expected === 'string' && value.includes(expected);
    case 'not_contains': return typeof value === 'string' && typeof expected === 'string' && !value.includes(expected);
    case 'is_null': return value === null || value === undefined;
    case 'is_not_null': return value !== null && value !== undefined;
    default: return false;
  }
}

function isWithinTimeWindow(window: NonNullable<Rule['timeWindow']>, now: Date): boolean {
  if (window.startDate && now < new Date(window.startDate)) return false;
  if (window.endDate && now > new Date(window.endDate)) return false;

  if (window.daysOfWeek && window.daysOfWeek.length > 0) {
    if (!window.daysOfWeek.includes(now.getDay())) return false;
  }

  if (window.startTime || window.endTime) {
    const [startH = 0, startM = 0] = (window.startTime ?? '00:00').split(':').map(Number);
    const [endH = 23, endM = 59] = (window.endTime ?? '23:59').split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (nowMinutes < startMinutes || nowMinutes > endMinutes) return false;
  }

  return true;
}
