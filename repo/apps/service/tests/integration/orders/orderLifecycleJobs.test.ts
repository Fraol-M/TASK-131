/**
 * Integration tests for order lifecycle jobs: autoCancelJob and autoCloseJob.
 * Covers the traceability gaps for auto_cancel_at scheduling on submission,
 * auto-cancel of expired submitted orders, and auto-close of delivered orders
 * with RMA-skip behavior.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { runAutoCancelJob } from '../../../src/jobs/autoCancelJob.js';
import { runAutoCloseJob } from '../../../src/jobs/autoCloseJob.js';
import type { Order } from '@nexusorder/shared-types';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupCatalogItem() {
  const vendor = await vendorsService.createVendor({ name: 'Job Test Vendor', isActive: true });
  return catalogService.createItem({
    vendorId: vendor._id, name: 'Job Test Item', sku: 'JOB-001',
    unitPrice: 50, currency: 'CNY', taxRate: 0.08, stock: 100,
    isAvailable: true, eligibleScopes: [],
  });
}

async function setupUsersAndPlaceOrder(suffix: string) {
  await usersService.createUser({
    username: `job_student_${suffix}`, password: 'TestPass1!@#', role: 'student',
    scope: { school: 'JOB_SCHOOL' },
  });
  const item = await setupCatalogItem();
  const studentCookie = await login(`job_student_${suffix}`);

  await request(app).post('/api/carts/items').set('Cookie', studentCookie)
    .send({ catalogItemId: item._id, quantity: 1 });
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
  expect(coRes.status).toBe(201);

  const orderId = (coRes.body.data as { _id: string })._id;
  return { orderId, studentCookie };
}

// ─── auto_cancel_at scheduling on submission ────────────────────────────────

describe('auto_cancel_at scheduling on submission', () => {
  it('sets autoCancelAt on newly submitted order', async () => {
    const { orderId } = await setupUsersAndPlaceOrder('schedule1');

    const order = await getDb().collection<Order>('orders').findOne({ _id: orderId } as { _id: string });
    expect(order).not.toBeNull();
    expect(order!.state).toBe('submitted');
    expect(order!.autoCancelAt).toBeDefined();
    expect(order!.autoCancelAt).toBeInstanceOf(Date);

    // autoCancelAt should be in the future (default 30 minutes from now)
    expect(order!.autoCancelAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
  });
});

// ─── autoCancelJob integration ──────────────────────────────────────────────

describe('autoCancelJob (integration)', () => {
  it('cancels a submitted order whose autoCancelAt has passed', async () => {
    const { orderId } = await setupUsersAndPlaceOrder('autocancel1');

    // Manually set autoCancelAt to the past to simulate expiry
    await getDb().collection<Order>('orders').updateOne(
      { _id: orderId } as { _id: string },
      { $set: { autoCancelAt: new Date(Date.now() - 60_000) } },
    );

    await runAutoCancelJob();

    const order = await getDb().collection<Order>('orders').findOne({ _id: orderId } as { _id: string });
    expect(order!.state).toBe('cancelled');
    expect(order!.cancelledAt).toBeDefined();

    // Verify audit event was recorded
    const auditEvent = await getDb().collection('order_audit_events')
      .findOne({ targetId: orderId, action: 'order.cancelled' });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent!.meta.reason).toBe('auto_cancel_timeout');
  });

  it('does NOT cancel a submitted order whose autoCancelAt is in the future', async () => {
    const { orderId } = await setupUsersAndPlaceOrder('autocancel2');

    // autoCancelAt is already in the future (set by checkout), so job should skip it
    await runAutoCancelJob();

    const order = await getDb().collection<Order>('orders').findOne({ _id: orderId } as { _id: string });
    expect(order!.state).toBe('submitted');
  });

  it('does NOT cancel orders already in paid state', async () => {
    const { orderId } = await setupUsersAndPlaceOrder('autocancel3');

    // Simulate the order being paid and having an expired autoCancelAt
    const order = await getDb().collection<Order>('orders').findOne({ _id: orderId } as { _id: string });
    await getDb().collection<Order>('orders').updateOne(
      { _id: orderId } as { _id: string },
      { $set: { state: 'paid', autoCancelAt: new Date(Date.now() - 60_000), version: order!.version + 1 } },
    );

    await runAutoCancelJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: orderId } as { _id: string });
    expect(updated!.state).toBe('paid');
  });

  it('increments order version on cancellation (optimistic concurrency)', async () => {
    const { orderId } = await setupUsersAndPlaceOrder('autocancel4');

    const before = await getDb().collection<Order>('orders').findOne({ _id: orderId } as { _id: string });
    const versionBefore = before!.version;

    await getDb().collection<Order>('orders').updateOne(
      { _id: orderId } as { _id: string },
      { $set: { autoCancelAt: new Date(Date.now() - 60_000) } },
    );

    await runAutoCancelJob();

    const after = await getDb().collection<Order>('orders').findOne({ _id: orderId } as { _id: string });
    expect(after!.state).toBe('cancelled');
    expect(after!.version).toBe(versionBefore + 1);
  });
});

// ─── autoCloseJob integration ───────────────────────────────────────────────

describe('autoCloseJob (integration)', () => {
  /** Helper: insert a delivered order directly (bypasses the full lifecycle for close-job testing). */
  function makeDeliveredOrder(overrides: Partial<Order> = {}): Order & { _id: string } {
    const id = randomUUID();
    return {
      _id: id,
      orderNumber: `TEST-CLOSE-${id.slice(0, 6)}`,
      userId: 'job-close-user',
      userScopeSnapshot: { school: 'JOB_SCHOOL' },
      state: 'delivered',
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

  it('closes a delivered order whose autoCloseAt has passed and no RMA is open', async () => {
    const order = makeDeliveredOrder({
      autoCloseAt: new Date(Date.now() - 60_000),
      afterSalesState: 'none',
    });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated!.state).toBe('closed');
    expect(updated!.closedAt).toBeDefined();

    // Verify audit event
    const auditEvent = await getDb().collection('order_audit_events')
      .findOne({ targetId: order._id, action: 'order.closed' });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent!.meta.reason).toBe('auto_close');
  });

  it('does NOT close a delivered order with an active RMA (rma_requested)', async () => {
    const order = makeDeliveredOrder({
      autoCloseAt: new Date(Date.now() - 60_000),
      afterSalesState: 'rma_requested',
    });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated!.state).toBe('delivered');
  });

  it('does NOT close a delivered order with an active RMA (rma_approved)', async () => {
    const order = makeDeliveredOrder({
      autoCloseAt: new Date(Date.now() - 60_000),
      afterSalesState: 'rma_approved',
    });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated!.state).toBe('delivered');
  });

  it('does NOT close a delivered order whose autoCloseAt is in the future', async () => {
    const order = makeDeliveredOrder({
      autoCloseAt: new Date(Date.now() + 60_000 * 60 * 24 * 14),
      afterSalesState: 'none',
    });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated!.state).toBe('delivered');
  });

  it('increments version on close (optimistic concurrency)', async () => {
    const order = makeDeliveredOrder({
      autoCloseAt: new Date(Date.now() - 60_000),
    });
    await getDb().collection<Order>('orders').insertOne(order);

    await runAutoCloseJob();

    const updated = await getDb().collection<Order>('orders').findOne({ _id: order._id } as { _id: string });
    expect(updated!.state).toBe('closed');
    expect(updated!.version).toBe(2);
  });
});
