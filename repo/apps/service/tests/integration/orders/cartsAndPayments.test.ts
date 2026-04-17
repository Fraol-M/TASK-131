/**
 * Integration tests for remaining cart and payment read endpoints:
 * GET /api/carts/active, GET /api/carts/me, DELETE /api/carts/items/:catalogItemId
 * GET /api/payments/intents/:id, GET /api/payments/refunds/order/:orderId
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

async function setupItemAndStudent(suffix: string) {
  const vendor = await vendorsService.createVendor({ name: `CP Vendor ${suffix}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId: vendor._id, name: `CP Item ${suffix}`, sku: `CP-${suffix}`,
    unitPrice: 40, currency: 'CNY', taxRate: 0.08, stock: 50,
    isAvailable: true, eligibleScopes: [],
  });
  await usersService.createUser({
    username: `cp_student_${suffix}`, password: 'TestPass1!@#', role: 'student', scope: {},
  });
  const cookie = await login(`cp_student_${suffix}`);
  return { item, cookie };
}

// ─── Cart read endpoints ────────────────────────────────────────────────────

describe('GET /api/carts/active', () => {
  it('returns null when no cart exists', async () => {
    await usersService.createUser({
      username: 'cart_active_empty', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('cart_active_empty');
    const res = await request(app).get('/api/carts/active').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns cart with items after adding', async () => {
    const { item, cookie } = await setupItemAndStudent('active1');
    await request(app).post('/api/carts/items').set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 2 });

    const res = await request(app).get('/api/carts/active').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.subtotal).toBeGreaterThan(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/carts/active');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/carts/me', () => {
  it('returns same data as /active (canonical alias)', async () => {
    const { item, cookie } = await setupItemAndStudent('me1');
    await request(app).post('/api/carts/items').set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });

    const res = await request(app).get('/api/carts/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.items.length).toBe(1);
  });
});

// ─── Cart delete endpoint ───────────────────────────────────────────────────

describe('DELETE /api/carts/items/:catalogItemId', () => {
  it('removes an item from the cart', async () => {
    const { item, cookie } = await setupItemAndStudent('del1');
    await request(app).post('/api/carts/items').set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });

    // Verify item is in cart
    const beforeRes = await request(app).get('/api/carts/active').set('Cookie', cookie);
    expect(beforeRes.body.data.items.length).toBe(1);

    // Delete
    const res = await request(app)
      .delete(`/api/carts/items/${item._id}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('removed');

    // Verify cart is now empty
    const afterRes = await request(app).get('/api/carts/active').set('Cookie', cookie);
    expect(afterRes.body.data.items.length).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/carts/items/some-id');
    expect(res.status).toBe(401);
  });
});

// ─── Payment intent read endpoint ───────────────────────────────────────────

describe('GET /api/payments/intents/:id', () => {
  it('admin can read a payment intent by ID', async () => {
    // Full lifecycle: student checkout → advisor approve → admin create intent
    await usersService.createUser({
      username: 'pi_student', password: 'TestPass1!@#', role: 'student', scope: { school: 'PI_SCHOOL' },
    });
    await usersService.createUser({
      username: 'pi_advisor', password: 'TestPass1!@#', role: 'faculty_advisor', scope: { school: 'PI_SCHOOL' },
    });
    await usersService.createUser({
      username: 'pi_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });

    const vendor = await vendorsService.createVendor({ name: 'PI Vendor', isActive: true });
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'PI Item', sku: 'PI-001',
      unitPrice: 60, currency: 'CNY', taxRate: 0.08, stock: 50,
      isAvailable: true, eligibleScopes: [],
    });

    const studentCookie = await login('pi_student');
    const advisorCookie = await login('pi_advisor');
    const adminCookie = await login('pi_admin');

    await request(app).post('/api/carts/items').set('Cookie', studentCookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
    const orderId = (coRes.body.data as { _id: string })._id;

    await request(app).post(`/api/approvals/${orderId}/approve`).set('Cookie', advisorCookie);

    const intentRes = await request(app).post('/api/payments/intents').set('Cookie', adminCookie)
      .send({ orderId });
    const intentId = (intentRes.body.data as { _id: string })._id;

    // Read intent by ID
    const res = await request(app).get(`/api/payments/intents/${intentId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(intentId);
    expect(res.body.data.orderId).toBe(orderId);
    expect(res.body.data.status).toBe('pending');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/payments/intents/some-id');
    expect(res.status).toBe(401);
  });
});

// ─── Refund read endpoint ───────────────────────────────────────────────────

describe('GET /api/payments/refunds/order/:orderId', () => {
  it('admin can list refunds for an order', async () => {
    await usersService.createUser({
      username: 'ref_read_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('ref_read_admin');

    // No refunds exist yet for a random order — should return empty array
    const res = await request(app)
      .get('/api/payments/refunds/order/nonexistent-order-id')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/payments/refunds/order/some-id');
    expect(res.status).toBe(401);
  });
});
