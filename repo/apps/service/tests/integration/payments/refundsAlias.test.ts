/**
 * Integration tests for /api/refunds alias endpoints.
 * The app mounts the same refundsRouter at both /api/payments/refunds and /api/refunds.
 * These tests verify the alias paths work identically.
 *
 * Covers: POST /api/refunds, GET /api/refunds/order/:orderId
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function createPaidOrder(suffix: string) {
  await usersService.createUser({
    username: `rfa_student_${suffix}`, password: 'TestPass1!@#', role: 'student',
    scope: { school: 'RFA_SCHOOL' },
  });
  await usersService.createUser({
    username: `rfa_advisor_${suffix}`, password: 'TestPass1!@#', role: 'faculty_advisor',
    scope: { school: 'RFA_SCHOOL' },
  });
  await usersService.createUser({
    username: `rfa_admin_${suffix}`, password: 'TestPass1!@#', role: 'department_admin', scope: {},
  });

  const vendor = await vendorsService.createVendor({ name: `RFA Vendor ${suffix}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId: vendor._id, name: 'RFA Item', sku: `RFA-${suffix}`,
    unitPrice: 100, currency: 'CNY', taxRate: 0.08, stock: 50,
    isAvailable: true, eligibleScopes: [],
  });

  const studentCookie = await login(`rfa_student_${suffix}`);
  const advisorCookie = await login(`rfa_advisor_${suffix}`);
  const adminCookie = await login(`rfa_admin_${suffix}`);

  await request(app).post('/api/carts/items').set('Cookie', studentCookie)
    .send({ catalogItemId: item._id, quantity: 1 });
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
  const orderId = (coRes.body.data as { _id: string })._id;

  await request(app).post(`/api/approvals/${orderId}/approve`)
    .set('Cookie', advisorCookie).send({ reason: 'ok' });

  const intentRes = await request(app).post('/api/payments/intents')
    .set('Cookie', adminCookie).send({ orderId });
  const intentId = (intentRes.body.data as { _id: string })._id;
  await request(app).post(`/api/payments/intents/${intentId}/confirm`)
    .set('Cookie', adminCookie).send({ paymentReference: 'RFA-REF-TEST' });

  return { orderId, intentId, adminCookie };
}

describe('POST /api/refunds (alias)', () => {
  it('creates a refund via the alias path', async () => {
    const { orderId, intentId, adminCookie } = await createPaidOrder('alias1');

    const res = await request(app)
      .post('/api/refunds')
      .set('Cookie', adminCookie)
      .send({
        orderId,
        paymentIntentId: intentId,
        amount: 50,
        currency: 'CNY',
        reason: 'Alias path refund test',
        reasonCode: 'customer_request',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBe(orderId);
    expect(res.body.data.status).toBe('pending');
  });
});

describe('GET /api/refunds/order/:orderId (alias)', () => {
  it('lists refunds for an order via the alias path', async () => {
    const { orderId, intentId, adminCookie } = await createPaidOrder('alias2');

    // Create a refund first via the primary path
    await request(app).post('/api/payments/refunds').set('Cookie', adminCookie).send({
      orderId, paymentIntentId: intentId, amount: 30,
      currency: 'CNY', reason: 'Partial test', reasonCode: 'customer_request',
    });

    // Read via alias path
    const res = await request(app)
      .get(`/api/refunds/order/${orderId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].orderId).toBe(orderId);
  });

  it('returns empty array for order with no refunds', async () => {
    await usersService.createUser({
      username: 'rfa_admin_empty', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('rfa_admin_empty');
    const res = await request(app).get('/api/refunds/order/no-refunds-order').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/refunds/order/some-id');
    expect(res.status).toBe(401);
  });
});
