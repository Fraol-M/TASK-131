import type { UserScope } from './auth.js';

// ─── Rule Condition AST ────────────────────────────────────────────────────────
export type ConditionOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'not_in' | 'contains' | 'not_contains'
  | 'is_null' | 'is_not_null';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export type LogicalOperator = 'and' | 'or';

export interface ConditionGroup {
  logic: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
}

// ─── Time Window ──────────────────────────────────────────────────────────────
export interface TimeWindow {
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  daysOfWeek?: number[]; // 0=Sun, 6=Sat
  startDate?: Date;
  endDate?: Date;
}

// ─── Rule ─────────────────────────────────────────────────────────────────────
export type RuleStatus = 'draft' | 'active' | 'inactive' | 'archived';

export interface Rule {
  _id: string;
  name: string;
  description?: string;
  scope: UserScope;
  priority: number; // lower number = higher priority
  conditions: ConditionGroup;
  actions: RuleAction[];
  timeWindow?: TimeWindow;
  status: RuleStatus;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleAction {
  type: string;
  parameters: Record<string, unknown>;
}

export interface RuleVersion {
  _id: string;
  ruleId: string;
  version: number;
  snapshot: Rule;
  createdBy: string;
  createdAt: Date;
}

// ─── Conflict & Simulation ────────────────────────────────────────────────────
export type ConflictType = 'overlapping_scope' | 'priority_clash' | 'circular_dependency' | 'mutually_exclusive';

export interface RuleConflict {
  _id: string;
  ruleIds: string[];
  conflictType: ConflictType;
  description: string;
  remediationSuggestions: RemediationSuggestion[];
  detectedAt: Date;
  resolvedAt?: Date;
}

export type RemediationType =
  | 'lower_priority'
  | 'add_mutually_exclusive_condition'
  | 'narrow_scope'
  | 'add_time_window'
  | 'deactivate_one';

export interface RemediationSuggestion {
  type: RemediationType;
  description: string;
  targetRuleId: string;
  proposedChange?: Partial<Rule>;
}

export interface RuleSimulation {
  _id: string;
  ruleId: string;
  ruleVersion: number;
  historicalOrderIds: string[];
  matchedOrderIds: string[];
  totalOrders: number;
  matchedCount: number;
  simulatedBy: string;
  simulatedAt: Date;
}
