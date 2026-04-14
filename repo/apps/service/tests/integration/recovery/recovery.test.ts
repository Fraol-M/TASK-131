import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { runStartupRecovery } from '../../../src/recovery/recoveryScanner.js';
import { writeCheckpoint } from '../../../src/recovery/checkpointWriter.js';
import type { CheckpointLog, Order, OrderItem } from '@nexusorder/shared-types';

describe('recoveryScanner', () => {
  it('marks pending restore checkpoints as failed on startup', async () => {
    const operationId = `test-restore-${randomUUID()}`;
    await writeCheckpoint({
      operationType: 'restore',
      operationId,
      payload: { backupId: 'b1', restoreId: 'r1', restoredBy: 'user1' },
    });

    await runStartupRecovery();

    const record = await getDb().collection<CheckpointLog>('checkpoint_logs').findOne({ operationId });
    expect(record?.status).toBe('failed');
  });

  it('does nothing when no pending checkpoints exist', async () => {
    await expect(runStartupRecovery()).resolves.not.toThrow();
  });

  it('order_split compensation: deletes partial child order and moves items back to parent', async () => {
    const parentId = `parent-${randomUUID()}`;
    const childId = `child-${randomUUID()}`;
    const itemId = `item-${randomUUID()}`;
    const now = new Date();

    // Simulate a parent order
    await getDb().collection<Order>('orders').insertOne({
      _id: parentId,
      orderNumber: 'TEST-001',
      userId: 'usr1',
      userScopeSnapshot: {},
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 100,
      taxLines: [],
      taxTotal: 0,
      total: 100,
      currency: 'CNY',
      splitIntoIds: [childId],
      version: 2,
      createdAt: now,
      updatedAt: now,
    } as unknown as Order & { _id: string });

    // Simulate the partial child order (created but parent DB update may have failed)
    await getDb().collection<Order>('orders').insertOne({
      _id: childId,
      orderNumber: 'TEST-001-S1',
      userId: 'usr1',
      userScopeSnapshot: {},
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 50,
      taxLines: [],
      taxTotal: 0,
      total: 50,
      currency: 'CNY',
      parentOrderId: parentId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    } as unknown as Order & { _id: string });

    // Item re-parented to child
    await getDb().collection<OrderItem>('order_items').insertOne({
      _id: itemId,
      orderId: childId,
      catalogItemId: 'cat1',
      name: 'Widget',
      sku: 'W-001',
      quantity: 1,
      unitPrice: 50,
      taxRate: 0,
      lineTotal: 50,
    } as unknown as OrderItem & { _id: string });

    const operationId = `test-split-${randomUUID()}`;
    await writeCheckpoint({
      operationType: 'order_split',
      operationId,
      payload: { orderId: parentId, splitItemIds: [itemId], userId: 'user1' },
    });

    // Run recovery
    await runStartupRecovery();

    // Checkpoint should be recovered (not just pending)
    const cp = await getDb().collection<CheckpointLog>('checkpoint_logs').findOne({ operationId });
    expect(cp?.status).toBe('recovered');

    // Child order must be deleted
    const childOrder = await getDb().collection<Order>('orders').findOne({ _id: childId } as { _id: string });
    expect(childOrder).toBeNull();

    // Item must be moved back to parent
    const item = await getDb().collection<OrderItem>('order_items').findOne({ _id: itemId } as { _id: string });
    expect(item?.orderId).toBe(parentId);

    // Parent splitIntoIds should no longer contain childId
    const parent = await getDb().collection<Order>('orders').findOne({ _id: parentId } as { _id: string });
    expect((parent?.splitIntoIds ?? []).includes(childId)).toBe(false);

    // Parent financial fields must be recomputed from current items
    expect(parent?.subtotal).toBe(50);
    expect(parent?.taxTotal).toBe(0);
    expect(parent?.total).toBe(50);
  });

  it('order_split recovery recomputes parent financial fields correctly with tax', async () => {
    const parentId = `parent-tax-${randomUUID()}`;
    const childId = `child-tax-${randomUUID()}`;
    const item1Id = `item-tax1-${randomUUID()}`;
    const item2Id = `item-tax2-${randomUUID()}`;
    const now = new Date();

    // Parent order with stale financials (as if the split partially updated it)
    await getDb().collection<Order>('orders').insertOne({
      _id: parentId,
      orderNumber: 'TEST-TAX-001',
      userId: 'usr1',
      userScopeSnapshot: {},
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 30,  // stale: should be 80 after items return
      taxLines: [{ description: 'Tax (10%)', rate: 0.1, amount: 3 }],
      taxTotal: 3,
      total: 33,
      currency: 'CNY',
      splitIntoIds: [childId],
      version: 2,
      createdAt: now,
      updatedAt: now,
    } as unknown as Order & { _id: string });

    // One item stays with parent
    await getDb().collection<OrderItem>('order_items').insertOne({
      _id: item1Id,
      orderId: parentId,
      catalogItemId: 'cat1',
      name: 'Widget A',
      sku: 'WA-001',
      quantity: 1,
      unitPrice: 30,
      taxRate: 0.1,
      lineTotal: 30,
    } as unknown as OrderItem & { _id: string });

    // Child order with one item that should return to parent
    await getDb().collection<Order>('orders').insertOne({
      _id: childId,
      orderNumber: 'TEST-TAX-001-S1',
      userId: 'usr1',
      userScopeSnapshot: {},
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 50,
      taxLines: [{ description: 'Tax (10%)', rate: 0.1, amount: 5 }],
      taxTotal: 5,
      total: 55,
      currency: 'CNY',
      parentOrderId: parentId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    } as unknown as Order & { _id: string });

    await getDb().collection<OrderItem>('order_items').insertOne({
      _id: item2Id,
      orderId: childId,
      catalogItemId: 'cat2',
      name: 'Widget B',
      sku: 'WB-001',
      quantity: 1,
      unitPrice: 50,
      taxRate: 0.1,
      lineTotal: 50,
    } as unknown as OrderItem & { _id: string });

    const operationId = `test-split-tax-${randomUUID()}`;
    await writeCheckpoint({
      operationType: 'order_split',
      operationId,
      payload: { orderId: parentId, splitItemIds: [item2Id], userId: 'user1' },
    });

    await runStartupRecovery();

    const cp = await getDb().collection<CheckpointLog>('checkpoint_logs').findOne({ operationId });
    expect(cp?.status).toBe('recovered');

    // Parent must have both items now and correct financials
    const parent = await getDb().collection<Order>('orders').findOne({ _id: parentId } as { _id: string });
    expect(parent?.subtotal).toBe(80); // 30 + 50
    expect(parent?.taxTotal).toBe(8);  // (30 + 50) * 0.1
    expect(parent?.total).toBe(88);    // 80 + 8
    expect((parent?.splitIntoIds ?? []).includes(childId)).toBe(false);
  });

  it('order_split with no child order marks checkpoint as failed (no-op)', async () => {
    const operationId = `test-split-noop-${randomUUID()}`;
    await writeCheckpoint({
      operationType: 'order_split',
      operationId,
      payload: { orderId: `nonexistent-${randomUUID()}`, splitItemIds: [], userId: 'user1' },
    });

    await runStartupRecovery();

    const record = await getDb().collection<CheckpointLog>('checkpoint_logs').findOne({ operationId });
    expect(record?.status).toBe('failed');
  });

  it('order_merge compensation: deletes partial merged order', async () => {
    const sourceId1 = `src1-${randomUUID()}`;
    const sourceId2 = `src2-${randomUUID()}`;
    const mergedId = `merged-${randomUUID()}`;
    const now = new Date();

    // Simulate the partial merged order
    await getDb().collection<Order>('orders').insertOne({
      _id: mergedId,
      orderNumber: 'TEST-MERGE-M',
      userId: 'usr1',
      userScopeSnapshot: {},
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 200,
      taxLines: [],
      taxTotal: 0,
      total: 200,
      currency: 'CNY',
      mergedFromIds: [sourceId1, sourceId2],
      version: 1,
      createdAt: now,
      updatedAt: now,
    } as unknown as Order & { _id: string });

    const operationId = `test-merge-${randomUUID()}`;
    await writeCheckpoint({
      operationType: 'order_merge',
      operationId,
      payload: { orderIds: [sourceId1, sourceId2], userId: 'user1' },
    });

    await runStartupRecovery();

    const cp = await getDb().collection<CheckpointLog>('checkpoint_logs').findOne({ operationId });
    expect(cp?.status).toBe('recovered');

    // Merged order must be deleted
    const mergedOrder = await getDb().collection<Order>('orders').findOne({ _id: mergedId } as { _id: string });
    expect(mergedOrder).toBeNull();
  });
});
