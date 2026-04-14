/**
 * Integration tests for the deterministic simulation engine.
 * Verifies that rule simulation produces correct, deterministic results
 * against historical orders, and persists simulation records.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { simulationEngine } from '../../../src/rules/simulationEngine.js';
import type { Order, Rule, RuleSimulation } from '@nexusorder/shared-types';

function makeOrder(overrides: Partial<Order> = {}): Order & { _id: string } {
  const id = randomUUID();
  return {
    _id: id,
    orderNumber: `SIM-${id.slice(0, 6)}`,
    userId: 'sim-user',
    userScopeSnapshot: { school: 'SIM_SCHOOL' },
    state: 'submitted',
    afterSalesState: 'none',
    subtotal: 100,
    taxLines: [],
    taxTotal: 0,
    total: 100,
    currency: 'CNY',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Order & { _id: string };
}

function makeRule(overrides: Partial<Rule> = {}): Rule & { _id: string } {
  return {
    _id: randomUUID(),
    name: 'Test Simulation Rule',
    scope: {},
    priority: 1,
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'total', operator: 'gte', value: 200 },
      ],
    },
    actions: [{ type: 'flag', parameters: { reason: 'high_value' } }],
    status: 'active',
    version: 1,
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Rule & { _id: string };
}

describe('simulationEngine.simulate()', () => {
  it('matches orders that satisfy the rule conditions', async () => {
    const lowOrder = makeOrder({ total: 50 });
    const highOrder = makeOrder({ total: 300 });
    await getDb().collection<Order>('orders').insertMany([lowOrder, highOrder]);

    const rule = makeRule(); // gte 200

    const result = await simulationEngine.simulate({
      rule,
      historicalOrderIds: [lowOrder._id, highOrder._id],
      simulatedBy: 'test-admin',
    });

    expect(result.totalOrders).toBe(2);
    expect(result.matchedCount).toBe(1);
    expect(result.matchedOrderIds).toContain(highOrder._id);
    expect(result.matchedOrderIds).not.toContain(lowOrder._id);
  });

  it('returns deterministic results — same inputs produce same output', async () => {
    const orders = [
      makeOrder({ total: 250 }),
      makeOrder({ total: 50 }),
      makeOrder({ total: 500 }),
      makeOrder({ total: 150 }),
    ];
    await getDb().collection<Order>('orders').insertMany(orders);
    const orderIds = orders.map((o) => o._id);

    const rule = makeRule(); // gte 200

    const result1 = await simulationEngine.simulate({
      rule,
      historicalOrderIds: orderIds,
      simulatedBy: 'test-admin',
    });

    const result2 = await simulationEngine.simulate({
      rule,
      historicalOrderIds: orderIds,
      simulatedBy: 'test-admin',
    });

    // Same matched orders in same order (sorted by _id for determinism)
    expect(result1.matchedOrderIds).toEqual(result2.matchedOrderIds);
    expect(result1.matchedCount).toBe(result2.matchedCount);
    expect(result1.totalOrders).toBe(result2.totalOrders);
  });

  it('persists the simulation record to the database', async () => {
    const order = makeOrder({ total: 999 });
    await getDb().collection<Order>('orders').insertOne(order);

    const rule = makeRule();

    const result = await simulationEngine.simulate({
      rule,
      historicalOrderIds: [order._id],
      simulatedBy: 'persist-test-admin',
    });

    const stored = await getDb().collection<RuleSimulation>('rule_simulations')
      .findOne({ _id: result._id } as { _id: string });
    expect(stored).not.toBeNull();
    expect(stored!.ruleId).toBe(rule._id);
    expect(stored!.ruleVersion).toBe(rule.version);
    expect(stored!.simulatedBy).toBe('persist-test-admin');
    expect(stored!.matchedCount).toBe(1);
  });

  it('does not match orders when rule is inactive', async () => {
    const order = makeOrder({ total: 500 });
    await getDb().collection<Order>('orders').insertOne(order);

    const rule = makeRule({ status: 'inactive' });

    const result = await simulationEngine.simulate({
      rule,
      historicalOrderIds: [order._id],
      simulatedBy: 'test-admin',
    });

    expect(result.matchedCount).toBe(0);
    expect(result.matchedOrderIds).toEqual([]);
  });

  it('matches zero orders when none satisfy the condition', async () => {
    const orders = [
      makeOrder({ total: 10 }),
      makeOrder({ total: 50 }),
      makeOrder({ total: 99 }),
    ];
    await getDb().collection<Order>('orders').insertMany(orders);

    const rule = makeRule(); // gte 200

    const result = await simulationEngine.simulate({
      rule,
      historicalOrderIds: orders.map((o) => o._id),
      simulatedBy: 'test-admin',
    });

    expect(result.matchedCount).toBe(0);
    expect(result.totalOrders).toBe(3);
  });

  it('handles OR condition groups correctly', async () => {
    const cheapCny = makeOrder({ total: 50, currency: 'CNY' });
    const expensiveUsd = makeOrder({ total: 300, currency: 'USD' });
    const cheapUsd = makeOrder({ total: 20, currency: 'USD' });
    await getDb().collection<Order>('orders').insertMany([cheapCny, expensiveUsd, cheapUsd]);

    // Match orders with total >= 200 OR currency === 'USD'
    const rule = makeRule({
      conditions: {
        logic: 'or',
        conditions: [
          { field: 'total', operator: 'gte', value: 200 },
          { field: 'currency', operator: 'eq', value: 'USD' },
        ],
      },
    });

    const result = await simulationEngine.simulate({
      rule,
      historicalOrderIds: [cheapCny._id, expensiveUsd._id, cheapUsd._id],
      simulatedBy: 'test-admin',
    });

    expect(result.matchedCount).toBe(2);
    expect(result.matchedOrderIds).toContain(expensiveUsd._id);
    expect(result.matchedOrderIds).toContain(cheapUsd._id);
    expect(result.matchedOrderIds).not.toContain(cheapCny._id);
  });
});
