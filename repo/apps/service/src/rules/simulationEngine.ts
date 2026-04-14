import { getDb } from '../persistence/mongoClient.js';
import type { Rule, RuleSimulation, Order } from '@nexusorder/shared-types';
import { evaluateRule } from './ruleEvaluator.js';
import { randomUUID } from 'crypto';

export const simulationEngine = {
  /**
   * Simulate a rule against a set of historical orders.
   * Returns which orders would have been matched.
   * Results are deterministic — same inputs produce same outputs.
   */
  async simulate(params: {
    rule: Rule;
    historicalOrderIds: string[];
    simulatedBy: string;
  }): Promise<RuleSimulation> {
    const { rule, historicalOrderIds, simulatedBy } = params;

    // Load historical orders
    const orders = await getDb()
      .collection<Order>('orders')
      .find({ _id: { $in: historicalOrderIds } } as Record<string, unknown>)
      .toArray();

    const matchedOrderIds: string[] = [];

    // Sort orders by _id for determinism
    orders.sort((a, b) => a._id.localeCompare(b._id));

    for (const order of orders) {
      if (evaluateRule(rule, order as unknown as Record<string, unknown>)) {
        matchedOrderIds.push(order._id);
      }
    }

    const simulation: RuleSimulation & { _id: string } = {
      _id: randomUUID(),
      ruleId: rule._id,
      ruleVersion: rule.version,
      historicalOrderIds,
      matchedOrderIds,
      totalOrders: orders.length,
      matchedCount: matchedOrderIds.length,
      simulatedBy,
      simulatedAt: new Date(),
    };

    await getDb().collection<RuleSimulation>('rule_simulations').insertOne(simulation);

    return simulation;
  },
};
