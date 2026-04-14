/**
 * Unit tests for scheduled jobs — uses deterministic clock control via Date mock.
 *
 * These tests insert orders directly into MongoDB and assert that the job
 * transitions state correctly, without going through the full HTTP stack.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { runAutoCancelJob } from '../../../src/jobs/autoCancelJob.js';
import { runAutoCloseJob } from '../../../src/jobs/autoCloseJob.js';
import type { Order } from '@nexusorder/shared-types';

afterEach(() => {
  vi.useRealTimers();
});

function makeOrder(overrides: Partial<Order> & { _id?: string }): Order & { _id: string } {
  const id = overrides._id ?? randomUUID();
  return {
    _id: id,
    orderNumber: `TEST-${id.slice(0, 6)}`,
    userId: 'user-test',
    userScopeSnapshot: {},
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

// ─── autoCancelJob ───────────────────────────────────────────────────────────

describe('runAutoCancelJob', () => {
  it('cancels submitted orders whose autoCancelAt has passed', async () => {
    const pastTime = new Date(Date.now() - 60_000); // 1 minute ago
    const order = makeOrder({ state: 'submitted', autoCancelAt: pastTime });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCancelJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated?.state).toBe('cancelled');
    expect(updated?.cancelledAt).toBeDefined();
  });

  it('does NOT cancel submitted orders whose autoCancelAt is in the future', async () => {
    const futureTime = new Date(Date.now() + 60_000 * 60); // 1 hour from now
    const order = makeOrder({ state: 'submitted', autoCancelAt: futureTime });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCancelJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated?.state).toBe('submitted');
  });

  it('does NOT cancel orders that are already paid', async () => {
    const pastTime = new Date(Date.now() - 60_000);
    const order = makeOrder({ state: 'paid', autoCancelAt: pastTime });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCancelJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated?.state).toBe('paid'); // not cancelled
  });

  it('does nothing when no orders have expired autoCancelAt', async () => {
    await expect(runAutoCancelJob()).resolves.not.toThrow();
  });
});

// ─── autoCloseJob ────────────────────────────────────────────────────────────

describe('runAutoCloseJob', () => {
  it('closes delivered orders whose autoCloseAt has passed and no RMA is open', async () => {
    const pastTime = new Date(Date.now() - 60_000);
    const order = makeOrder({ state: 'delivered', afterSalesState: 'none', autoCloseAt: pastTime });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated?.state).toBe('closed');
  });

  it('does NOT close delivered orders with an open RMA', async () => {
    const pastTime = new Date(Date.now() - 60_000);
    const order = makeOrder({ state: 'delivered', afterSalesState: 'rma_requested', autoCloseAt: pastTime });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated?.state).toBe('delivered'); // not closed due to open RMA
  });

  it('does NOT close delivered orders whose autoCloseAt is in the future', async () => {
    const futureTime = new Date(Date.now() + 60_000 * 60 * 24 * 14);
    const order = makeOrder({ state: 'delivered', afterSalesState: 'none', autoCloseAt: futureTime });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated?.state).toBe('delivered');
  });

  it('does nothing when no delivered orders have passed autoCloseAt', async () => {
    await expect(runAutoCloseJob()).resolves.not.toThrow();
  });
});
