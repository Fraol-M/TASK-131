/**
 * Integration tests for refund flow integrity.
 * Covers the high-severity finding: refund records could be created with
 * inconsistent orderId/paymentIntentId combinations, and refunds could be
 * issued against payments in ineligible states.
 */
import { describe, it, expect } from 'vitest';
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

async function setupCatalogItem() {
  const vendor = await vendorsService.createVendor({ name: 'Refund Test Vendor', isActive: true });
  return catalogService.createItem({
    vendorId: vendor._id, name: 'Refund Test Item', sku: 'REF-001',
    unitPrice: 100, currency: 'CNY', taxRate: 0.08, stock: 50,
    isAvailable: true, eligibleScopes: [],
  });
}

/**
 * Creates a fully paid order and returns the orderId, paymentIntentId, and admin cookie.
 */
async function createPaidOrder(suffix: string) {
  await usersService.createUser({
    username: `ref_student_${suffix}`, password: 'TestPass1!@#', role: 'student',
    scope: { school: 'REF_SCHOOL' },
  });
  await usersService.createUser({
    username: `ref_advisor_${suffix}`, password: 'TestPass1!@#', role: 'faculty_advisor',
    scope: { school: 'REF_SCHOOL' },
  });
  await usersService.createUser({
    username: `ref_admin_${suffix}`, password: 'TestPass1!@#', role: 'department_admin',
    scope: {},
  });

  const item = await setupCatalogItem();
  const studentCookie = await login(`ref_student_${suffix}`);
  const advisorCookie = await login(`ref_advisor_${suffix}`);
  const adminCookie = await login(`ref_admin_${suffix}`);

  // Cart → checkout
  await request(app).post('/api/carts/items').set('Cookie', studentCookie)
    .send({ catalogItemId: item._id, quantity: 1 });
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
  const orderId = (coRes.body.data as { _id: string })._id;

  // Approve
  await request(app).post(`/api/approvals/${orderId}/approve`)
    .set('Cookie', advisorCookie).send({ reason: 'ok' });

  // Create and confirm payment
  const intentRes = await request(app).post('/api/payments/intents')
    .set('Cookie', adminCookie).send({ orderId });
  const intentId = (intentRes.body.data as { _id: string })._id;
  await request(app).post(`/api/payments/intents/${intentId}/confirm`)
    .set('Cookie', adminCookie).send({ paymentReference: 'WECHAT_REF_TEST' });

  return { orderId, intentId, adminCookie };
}

describe('Refund integrity: orderId/paymentIntentId linkage', () => {
  it('accepts refund when orderId and paymentIntentId match', async () => {
    const { orderId, intentId, adminCookie } = await createPaidOrder('match');

    const res = await request(app)
      .post('/api/payments/refunds')
      .set('Cookie', adminCookie)
      .send({
        orderId,
        paymentIntentId: intentId,
        amount: 50,
        currency: 'CNY',
        reason: 'Partial refund test',
        reasonCode: 'customer_request',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBe(orderId);
    expect(res.body.data.paymentIntentId).toBe(intentId);
    expect(res.body.data.status).toBe('pending');
  });

  it('rejects refund when orderId does not match paymentIntentId', async () => {
    const order1 = await createPaidOrder('mismatch1');
    const order2 = await createPaidOrder('mismatch2');

    // Try to create a refund linking order1's payment intent to order2's orderId
    const res = await request(app)
      .post('/api/payments/refunds')
      .set('Cookie', order1.adminCookie)
      .send({
        orderId: order2.orderId,
        paymentIntentId: order1.intentId,
        amount: 50,
        currency: 'CNY',
        reason: 'Mismatched refund attempt',
        reasonCode: 'customer_request',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REFUND_ORDER_MISMATCH');
  });
});

describe('Refund integrity: payment status eligibility', () => {
  it('rejects refund when payment intent is still pending', async () => {
    // Create order through approval but don't confirm payment
    await usersService.createUser({
      username: 'ref_student_pending', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'REF_SCHOOL' },
    });
    await usersService.createUser({
      username: 'ref_advisor_pending', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'REF_SCHOOL' },
    });
    await usersService.createUser({
      username: 'ref_admin_pending', password: 'TestPass1!@#', role: 'department_admin',
      scope: {},
    });

    const item = await setupCatalogItem();
    const studentCookie = await login('ref_student_pending');
    const advisorCookie = await login('ref_advisor_pending');
    const adminCookie = await login('ref_admin_pending');

    await request(app).post('/api/carts/items').set('Cookie', studentCookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
    const orderId = (coRes.body.data as { _id: string })._id;

    await request(app).post(`/api/approvals/${orderId}/approve`)
      .set('Cookie', advisorCookie).send({ reason: 'ok' });

    // Create intent but do NOT confirm — status remains 'pending'
    const intentRes = await request(app).post('/api/payments/intents')
      .set('Cookie', adminCookie).send({ orderId });
    const intentId = (intentRes.body.data as { _id: string })._id;

    const res = await request(app)
      .post('/api/payments/refunds')
      .set('Cookie', adminCookie)
      .send({
        orderId,
        paymentIntentId: intentId,
        amount: 50,
        currency: 'CNY',
        reason: 'Refund on pending payment',
        reasonCode: 'customer_request',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_NOT_REFUNDABLE');
  });
});

describe('Refund integrity: amount limits', () => {
  it('rejects refund that exceeds paid amount', async () => {
    const { orderId, intentId, adminCookie } = await createPaidOrder('exceed');

    // Get the order total to know the limit
    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', adminCookie);
    const total = (orderRes.body.data as { total: number }).total;

    const res = await request(app)
      .post('/api/payments/refunds')
      .set('Cookie', adminCookie)
      .send({
        orderId,
        paymentIntentId: intentId,
        amount: total + 1,
        currency: 'CNY',
        reason: 'Over-refund attempt',
        reasonCode: 'customer_request',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REFUND_EXCEEDS_PAID');
  });
});
