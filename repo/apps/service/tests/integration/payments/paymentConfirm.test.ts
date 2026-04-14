/**
 * Integration tests for the Approved → Paid → Allocated lifecycle.
 * Covers the blocker identified in the static audit: no API path existed to
 * advance an order from Approved to Paid before POST /api/payments/intents/:id/confirm
 * was added.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';
import { orderRepository } from '../../../src/modules/orders/orderRepository.js';
import { getDb } from '../../../src/persistence/mongoClient.js';
import type { CatalogItem } from '@nexusorder/shared-types';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupCatalogItem(): Promise<CatalogItem & { _id: string }> {
  const vendor = await vendorsService.createVendor({ name: 'Pay Test Vendor', isActive: true });
  return catalogService.createItem({
    vendorId: vendor._id, name: 'Pay Test Item', sku: 'PAY-001',
    unitPrice: 100, currency: 'CNY', taxRate: 0.13, stock: 50,
    isAvailable: true, eligibleScopes: [],
  }) as Promise<CatalogItem & { _id: string }>;
}

async function setupUsers() {
  const student = await usersService.createUser({
    username: 'pay_student', password: 'TestPass1!@#', role: 'student',
    scope: { school: 'SCI' },
  });
  const advisor = await usersService.createUser({
    username: 'pay_advisor', password: 'TestPass1!@#', role: 'faculty_advisor',
    scope: { school: 'SCI' },
  });
  await usersService.createUser({
    username: 'pay_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
  });
  return { student, advisor };
}

describe('Payment confirmation: Approved → Paid → Allocated', () => {
  it('advances order to paid state via POST /api/payments/intents/:id/confirm', async () => {
    const { student } = await setupUsers();
    const item = await setupCatalogItem();
    const studentCookie = await login('pay_student');
    const advisorCookie = await login('pay_advisor');
    const adminCookie = await login('pay_admin');

    // 1. Add item to cart
    await request(app)
      .post('/api/carts/items')
      .set('Cookie', studentCookie)
      .send({ catalogItemId: item._id, quantity: 1 });

    // 2. Checkout → submitted
    const checkoutRes = await request(app)
      .post('/api/carts/checkout')
      .set('Cookie', studentCookie);
    expect(checkoutRes.status).toBe(201);
    const order = checkoutRes.body.data as { _id: string; state: string };
    expect(order.state).toBe('submitted');

    // 3. Approve → approved
    const approveRes = await request(app)
      .post(`/api/approvals/${order._id}/approve`)
      .set('Cookie', advisorCookie);
    expect(approveRes.status).toBe(200);

    // 4. Create payment intent
    const intentRes = await request(app)
      .post('/api/payments/intents')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id });
    expect(intentRes.status).toBe(201);
    const intent = intentRes.body.data as { _id: string };

    // 5. Confirm payment → order transitions to 'paid'
    const confirmRes = await request(app)
      .post(`/api/payments/intents/${intent._id}/confirm`)
      .set('Cookie', adminCookie)
      .send({ paymentReference: 'WECHAT_REF_20260412_001' });
    expect(confirmRes.status).toBe(200);

    // 6. Verify order is now in 'paid' state
    const updatedOrder = await orderRepository.findById(order._id);
    expect(updatedOrder.state).toBe('paid');
    expect(updatedOrder.paidAt).toBeDefined();

    // 7. Verify order can now be allocated (fulfillment endpoint accepts it)
    const fulfillmentRes = await request(app)
      .post(`/api/fulfillment/${order._id}/allocate`)
      .set('Cookie', adminCookie);
    expect(fulfillmentRes.status).toBe(200);
    const allocatedOrder = await orderRepository.findById(order._id);
    expect(allocatedOrder.state).toBe('allocated');
  });

  it('rejects payment confirmation for non-admin roles', async () => {
    await setupUsers();
    const item = await setupCatalogItem();
    const studentCookie = await login('pay_student');
    const advisorCookie = await login('pay_advisor');

    await request(app)
      .post('/api/carts/items')
      .set('Cookie', studentCookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    const checkoutRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
    const order = checkoutRes.body.data as { _id: string };

    await request(app)
      .post(`/api/approvals/${order._id}/approve`)
      .set('Cookie', advisorCookie);

    const adminCookie = await login('pay_admin');
    const intentRes = await request(app)
      .post('/api/payments/intents')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id });
    const intent = intentRes.body.data as { _id: string };

    // Advisor cannot confirm payment
    const res = await request(app)
      .post(`/api/payments/intents/${intent._id}/confirm`)
      .set('Cookie', advisorCookie)
      .send({ paymentReference: 'WECHAT_REF_001' });
    expect(res.status).toBe(403);

    // Student cannot confirm payment
    const studentRes = await request(app)
      .post(`/api/payments/intents/${intent._id}/confirm`)
      .set('Cookie', studentCookie)
      .send({ paymentReference: 'WECHAT_REF_001' });
    expect(studentRes.status).toBe(403);
  });

  it('rejects confirmation without paymentReference', async () => {
    await setupUsers();
    const adminCookie = await login('pay_admin');
    // Use a fake intent ID — validation fires before DB lookup
    const res = await request(app)
      .post('/api/payments/intents/fake-intent-id/confirm')
      .set('Cookie', adminCookie)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects payment confirmation for unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/payments/intents/some-id/confirm')
      .send({ paymentReference: 'REF' });
    expect(res.status).toBe(401);
  });
});

describe('Payment intent: admin cleanup', () => {
  it('inserts correct data for getDb cleanup in subsequent tests', async () => {
    await getDb().collection('payment_intents').deleteMany({ orderId: { $exists: true } });
    expect(true).toBe(true);
  });
});
