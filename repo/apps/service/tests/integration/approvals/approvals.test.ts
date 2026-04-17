/**
 * Integration tests for approval endpoints:
 * GET /api/approvals/pending, POST /:orderId/reject, POST /:orderId/decide
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

async function setupAndCheckout(suffix: string) {
  await usersService.createUser({
    username: `appr_student_${suffix}`, password: 'TestPass1!@#', role: 'student',
    scope: { school: 'APPR_SCHOOL' },
  });
  await usersService.createUser({
    username: `appr_advisor_${suffix}`, password: 'TestPass1!@#', role: 'faculty_advisor',
    scope: { school: 'APPR_SCHOOL' },
  });
  await usersService.createUser({
    username: `appr_admin_${suffix}`, password: 'TestPass1!@#', role: 'department_admin',
    scope: {},
  });

  const vendor = await vendorsService.createVendor({ name: `Appr Vendor ${suffix}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId: vendor._id, name: 'Appr Item', sku: `APPR-${suffix}`,
    unitPrice: 50, currency: 'CNY', taxRate: 0.08, stock: 100,
    isAvailable: true, eligibleScopes: [],
  });

  const studentCookie = await login(`appr_student_${suffix}`);
  await request(app).post('/api/carts/items').set('Cookie', studentCookie)
    .send({ catalogItemId: item._id, quantity: 1 });
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
  const orderId = (coRes.body.data as { _id: string })._id;

  return {
    orderId,
    studentCookie,
    advisorCookie: await login(`appr_advisor_${suffix}`),
    adminCookie: await login(`appr_admin_${suffix}`),
  };
}

describe('GET /api/approvals/pending', () => {
  it('returns submitted orders for advisor in scope', async () => {
    const { advisorCookie } = await setupAndCheckout('pend1');
    const res = await request(app).get('/api/approvals/pending').set('Cookie', advisorCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].state).toBe('submitted');
    expect(res.body.data[0].itemCount).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/approvals/pending');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student (no approvals:approve permission)', async () => {
    const { studentCookie } = await setupAndCheckout('pend2');
    const res = await request(app).get('/api/approvals/pending').set('Cookie', studentCookie);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/approvals/:orderId/reject', () => {
  it('rejects a submitted order with reason', async () => {
    const { orderId, advisorCookie } = await setupAndCheckout('rej1');
    const res = await request(app)
      .post(`/api/approvals/${orderId}/reject`)
      .set('Cookie', advisorCookie)
      .send({ reason: 'Budget exceeded' });
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('denied');
  });

  it('reject transitions order to cancelled state', async () => {
    const { orderId, advisorCookie, adminCookie } = await setupAndCheckout('rej2');
    await request(app).post(`/api/approvals/${orderId}/reject`)
      .set('Cookie', advisorCookie).send({ reason: 'Not needed' });

    const orderRes = await request(app).get(`/api/orders/${orderId}`).set('Cookie', adminCookie);
    expect(orderRes.body.data.state).toBe('cancelled');
  });

  it('returns 403 for student', async () => {
    const { orderId, studentCookie } = await setupAndCheckout('rej3');
    const res = await request(app).post(`/api/approvals/${orderId}/reject`)
      .set('Cookie', studentCookie).send({ reason: 'nope' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/approvals/:orderId/decide', () => {
  it('approves via decide endpoint', async () => {
    const { orderId, advisorCookie } = await setupAndCheckout('dec1');
    const res = await request(app)
      .post(`/api/approvals/${orderId}/decide`)
      .set('Cookie', advisorCookie)
      .send({ decision: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('approved');
  });

  it('denies via decide endpoint with reason', async () => {
    const { orderId, advisorCookie } = await setupAndCheckout('dec2');
    const res = await request(app)
      .post(`/api/approvals/${orderId}/decide`)
      .set('Cookie', advisorCookie)
      .send({ decision: 'denied', reason: 'Not appropriate' });
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('denied');
  });

  it('rejects invalid decision value', async () => {
    const { orderId, advisorCookie } = await setupAndCheckout('dec3');
    const res = await request(app)
      .post(`/api/approvals/${orderId}/decide`)
      .set('Cookie', advisorCookie)
      .send({ decision: 'maybe' });
    expect(res.status).toBe(400);
  });
});
