import { z } from 'zod';
import { userScopeSchema } from './auth.js';

export const conditionOperatorSchema = z.enum([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'in', 'not_in', 'contains', 'not_contains',
  'is_null', 'is_not_null',
]);

export const conditionSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({
      field: z.string().min(1),
      operator: conditionOperatorSchema,
      value: z.unknown().optional(),
    }),
    z.object({
      logic: z.enum(['and', 'or']),
      conditions: z.array(conditionSchema).min(1),
    }),
  ]),
);

export const timeWindowSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const ruleActionSchema = z.object({
  type: z.string().min(1),
  parameters: z.record(z.unknown()),
});

export const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  scope: userScopeSchema,
  priority: z.number().int().min(0).max(9999),
  conditions: conditionSchema,
  actions: z.array(ruleActionSchema).min(1),
  timeWindow: timeWindowSchema.optional(),
});

export const ruleSimulationSchema = z.object({
  ruleId: z.string(),
  historicalOrderIds: z.array(z.string()).min(1).max(1000),
});
