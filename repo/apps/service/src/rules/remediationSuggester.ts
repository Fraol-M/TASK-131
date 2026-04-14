import type { Rule, RemediationSuggestion, ConflictType } from '@nexusorder/shared-types';

type SuggestionFn = (a: Rule, b: Rule) => RemediationSuggestion[];

const SUGGESTION_STRATEGIES: Partial<Record<ConflictType, SuggestionFn>> = {
  priority_clash: (a, b) => [
    {
      type: 'lower_priority',
      description: `Lower the priority of rule "${b.name}" to resolve the clash with "${a.name}"`,
      targetRuleId: b._id,
      proposedChange: { priority: a.priority + 1 },
    },
    {
      type: 'add_mutually_exclusive_condition',
      description: `Add a mutually exclusive condition to rule "${b.name}" so it does not apply in the same context as "${a.name}"`,
      targetRuleId: b._id,
    },
    {
      type: 'narrow_scope',
      description: `Narrow the scope of rule "${b.name}" to avoid overlap with "${a.name}"`,
      targetRuleId: b._id,
    },
  ],

  overlapping_scope: (a, b) => [
    {
      type: 'deactivate_one',
      description: `Deactivate rule "${b.name}" if it duplicates the effect of "${a.name}"`,
      targetRuleId: b._id,
    },
    {
      type: 'narrow_scope',
      description: `Narrow the scope of rule "${b.name}" to prevent overlap with "${a.name}"`,
      targetRuleId: b._id,
    },
    {
      type: 'add_time_window',
      description: `Add a time window to rule "${b.name}" to separate when it applies from "${a.name}"`,
      targetRuleId: b._id,
    },
  ],
};

export const remediationSuggester = {
  suggest(conflictType: ConflictType, a: Rule, b: Rule): RemediationSuggestion[] {
    const strategy = SUGGESTION_STRATEGIES[conflictType];
    return strategy ? strategy(a, b) : [];
  },
};
