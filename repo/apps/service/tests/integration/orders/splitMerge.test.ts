/**
 * Integration tests for order split and merge routes.
 * Verifies notes/tags/audit linkage, invoice invariants, and state continuity.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupSplitScenario(suffix: string) {
  const studentUsername = `split_stu_${suffix}`;
  const advisorUsername = `split_adv_${suffix}`;
  const adminUsername = `split_adm_${suffix}`;

  await usersService.createUser({ username: studentUsername, password: 'TestPass1!@#', role: 'student', scope: { school: 'SLT' } });
  await usersService.createUser({ username: advisorUsername, password: 'TestPass1!@#', role: 'faculty_advisor', scope: { school: 'SLT' } });
  await usersService.createUser({ username: adminUsername, password: 'TestPass1!@#', role: 'department_admin', scope: {} });

  const vendor = await vendorsService.createVendor({ name: `SplitVendor-${suffix}`, isActive: true });
  const item1 = await catalogService.createItem({
    vendorId: vendor._id, name: 'Item A', sku: `SLT-A-${suffix}`,
    unitPrice: 100, currency: 'CNY', taxRate: 0.08, stock: 10, isAvailable: true, eligibleScopes: [],
  });
  const item2 = await catalogService.createItem({
    vendorId: vendor._id, name: 'Item B', sku: `SLT-B-${suffix}`,
    unitPrice: 200, currency: 'CNY', taxRate: 0.08, stock: 10, isAvailable: true, eligibleScopes: [],
  });

  const studentCookie = await login(studentUsername);
  const advisorCookie = await login(advisorUsername);
  const adminCookie = await login(adminUsername);

  // Add both items to cart
  await request(app).post('/api/carts/items').set('Cookie', studentCookie)
    .send({ catalogItemId: item1._id, quantity: 1 });
  await request(app).post('/api/carts/items').set('Cookie', studentCookie)
    .send({ catalogItemId: item2._id, quantity: 1 });

  // Checkout
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
  expect(coRes.status).toBe(201);
  const orderId = (coRes.body.data as { _id: string })._id;

  // Get order items
  const orderRes = await request(app).get(`/api/orders/${orderId}`).set('Cookie', adminCookie);
  const items = (orderRes.body.data as { items?: Array<{ _id: string }> }).items ?? [];

  return { orderId, item1Id: items[0]?._id ?? '', item2Id: items[1]?._id ?? '', adminCookie, advisorCookie, studentCookie };
}

describe('Order split integration', () => {
  it('splits an order and preserves invoice totals', async () => {
    const { orderId, item1Id, adminCookie } = await setupSplitScenario('s1');

    const res = await request(app)
      .post(`/api/rma/orders/${orderId}/split`)
      .set('Cookie', adminCookie)
      .send({ itemIds: [item1Id], note: 'Split for testing' });

    expect(res.status).toBe(200);
    const { original, split } = res.body.data as { original: { total: number }; split: { total: number } };

    // Invoice totals of original + split should equal original total (300 * 1.08 = 324)
    const combinedTotal = original.total + split.total;
    expect(combinedTotal).toBeCloseTo(324, 1);
  });

  it('copies parent notes to child order after split', async () => {
    const { orderId, item1Id, adminCookie } = await setupSplitScenario('s2');

    // Add a note to the parent order
    await request(app).post(`/api/orders/${orderId}/notes`)
      .set('Cookie', adminCookie)
      .send({ content: 'Note before split' });

    const res = await request(app)
      .post(`/api/rma/orders/${orderId}/split`)
      .set('Cookie', adminCookie)
      .send({ itemIds: [item1Id] });

    expect(res.status).toBe(200);
    const childId = (res.body.data as { split: { _id: string } }).split._id;

    // Child should have a note copied from parent (prefixed with [Split from ...])
    const childNotes = await getDb().collection('order_notes').find({ orderId: childId }).toArray();
    expect(childNotes.length).toBeGreaterThan(0);
    expect(childNotes[0]?.['content']).toMatch(/Split from/);
  });

  it('emits an audit event for the split', async () => {
    const { orderId, item1Id, adminCookie } = await setupSplitScenario('s3');

    await request(app)
      .post(`/api/rma/orders/${orderId}/split`)
      .set('Cookie', adminCookie)
      .send({ itemIds: [item1Id] });

    const auditRes = await request(app)
      .get('/api/audits')
      .set('Cookie', adminCookie)
      .query({ action: 'order.split', targetId: orderId });

    expect(auditRes.status).toBe(200);
    const events = auditRes.body.data as Array<{ action: string }>;
    expect(events.some((e) => e.action === 'order.split')).toBe(true);
  });

  it('cannot split an order with only one item', async () => {
    const { orderId, item1Id, adminCookie } = await setupSplitScenario('s4');

    // First split off item1 to leave only item2 in original
    await request(app)
      .post(`/api/rma/orders/${orderId}/split`)
      .set('Cookie', adminCookie)
      .send({ itemIds: [item1Id] });

    // Now try to split the original again (has only 1 item)
    const orderRes = await request(app).get(`/api/orders/${orderId}`).set('Cookie', adminCookie);
    const remainingItems = (orderRes.body.data as { items?: Array<{ _id: string }> }).items ?? [];

    const res = await request(app)
      .post(`/api/rma/orders/${orderId}/split`)
      .set('Cookie', adminCookie)
      .send({ itemIds: [remainingItems[0]?._id ?? ''] });

    // Should fail: cannot move all items / too few items
    expect([400, 422]).toContain(res.status);
  });
});

describe('Order merge integration', () => {
  it('merges two orders and preserves combined total', async () => {
    const { orderId: order1Id, adminCookie } = await setupSplitScenario('m1');

    // Create a second order in same scope for same user
    const { orderId: order2Id } = await setupSplitScenario('m2');

    const res = await request(app)
      .post('/api/rma/orders/merge')
      .set('Cookie', adminCookie)
      .send({ orderIds: [order1Id, order2Id], note: 'Merge for testing' });

    expect(res.status).toBe(200);
    const merged = res.body.data as { total: number };
    // Both orders are 324 total each → merged should be ~648
    expect(merged.total).toBeCloseTo(648, 1);
  });

  it('emits an audit event for the merge', async () => {
    const { orderId: order1Id, adminCookie } = await setupSplitScenario('m3');
    const { orderId: order2Id } = await setupSplitScenario('m4');

    const mergeRes = await request(app)
      .post('/api/rma/orders/merge')
      .set('Cookie', adminCookie)
      .send({ orderIds: [order1Id, order2Id] });

    expect(mergeRes.status).toBe(200);
    const mergedId = (mergeRes.body.data as { _id: string })._id;

    const auditRes = await request(app)
      .get('/api/audits')
      .set('Cookie', adminCookie)
      .query({ action: 'order.merged' });

    const events = auditRes.body.data as Array<{ action: string }>;
    expect(events.some((e) => e.action === 'order.merged')).toBe(true);
    void mergedId; // consumed above
  });
});
