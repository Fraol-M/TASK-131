/**
 * Integration tests for after-sales endpoints:
 * GET /api/reason-codes, POST /api/reason-codes, PATCH /api/reason-codes/:id
 * POST /api/rma/:rmaId/approve
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

// ─── Reason Codes ───────────────────────────────────────────────────────────

describe('GET /api/reason-codes', () => {
  it('any authenticated user can list reason codes', async () => {
    await usersService.createUser({
      username: 'rc_student_list', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('rc_student_list');
    const res = await request(app).get('/api/reason-codes').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/reason-codes');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/reason-codes', () => {
  it('admin can create a reason code', async () => {
    await usersService.createUser({
      username: 'rc_admin_create', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('rc_admin_create');

    const res = await request(app).post('/api/reason-codes').set('Cookie', cookie).send({
      code: 'DEFECTIVE_ITEM',
      label: 'Item arrived defective',
      applicableTo: ['return', 'refund'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('DEFECTIVE_ITEM');
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'rc_student_create', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('rc_student_create');
    const res = await request(app).post('/api/reason-codes').set('Cookie', cookie).send({
      code: 'HACK', label: 'Hack code', applicableTo: ['return'],
    });
    expect(res.status).toBe(403);
  });

  it('rejects invalid code format', async () => {
    await usersService.createUser({
      username: 'rc_admin_invalid', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('rc_admin_invalid');
    const res = await request(app).post('/api/reason-codes').set('Cookie', cookie).send({
      code: 'invalid lowercase', label: 'Bad', applicableTo: ['return'],
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/reason-codes/:id', () => {
  it('admin can update a reason code', async () => {
    await usersService.createUser({
      username: 'rc_admin_patch', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('rc_admin_patch');

    // Create first
    const createRes = await request(app).post('/api/reason-codes').set('Cookie', cookie).send({
      code: 'WRONG_SIZE', label: 'Wrong size', applicableTo: ['exchange'],
    });
    const rcId = createRes.body.data._id;

    // Update
    const res = await request(app).patch(`/api/reason-codes/${rcId}`).set('Cookie', cookie).send({
      label: 'Wrong size or fit',
      applicableTo: ['exchange', 'return'],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('Wrong size or fit');
  });
});

// ─── RMA Approve ────────────────────────────────────────────────────────────

describe('POST /api/rma/:rmaId/approve', () => {
  it('admin can approve an RMA request', async () => {
    // Set up a full lifecycle to delivered state, then create RMA
    await usersService.createUser({
      username: 'rma_student', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'RMA_SCHOOL' },
    });
    await usersService.createUser({
      username: 'rma_advisor', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'RMA_SCHOOL' },
    });
    await usersService.createUser({
      username: 'rma_mentor', password: 'TestPass1!@#', role: 'corporate_mentor',
      scope: { school: 'RMA_SCHOOL' },
    });
    await usersService.createUser({
      username: 'rma_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });

    const vendor = await vendorsService.createVendor({ name: 'RMA Vendor', isActive: true });
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'RMA Item', sku: 'RMA-001',
      unitPrice: 60, currency: 'CNY', taxRate: 0.08, stock: 50,
      isAvailable: true, eligibleScopes: [],
    });

    const studentCookie = await login('rma_student');
    const advisorCookie = await login('rma_advisor');
    const mentorCookie = await login('rma_mentor');
    const adminCookie = await login('rma_admin');

    // Cart → checkout → approve → pay → allocate → ship → deliver
    await request(app).post('/api/carts/items').set('Cookie', studentCookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
    const orderId = (coRes.body.data as { _id: string })._id;

    await request(app).post(`/api/approvals/${orderId}/approve`).set('Cookie', advisorCookie);

    const intentRes = await request(app).post('/api/payments/intents').set('Cookie', adminCookie)
      .send({ orderId });
    const intentId = (intentRes.body.data as { _id: string })._id;
    await request(app).post(`/api/payments/intents/${intentId}/confirm`).set('Cookie', adminCookie)
      .send({ paymentReference: 'RMA-REF-001' });

    await request(app).post(`/api/fulfillment/${orderId}/allocate`).set('Cookie', adminCookie);
    await request(app).post(`/api/fulfillment/${orderId}/ship`).set('Cookie', adminCookie)
      .send({ trackingNumber: 'RMA-TRK-001' });
    await request(app).post(`/api/fulfillment/${orderId}/confirm-delivery`).set('Cookie', mentorCookie)
      .send({ conditionNote: 'Good' });

    // Create RMA request — need a reason code first
    const rcRes = await request(app).post('/api/reason-codes').set('Cookie', adminCookie).send({
      code: 'DAMAGED_IN_TRANSIT', label: 'Damaged during shipping', applicableTo: ['return'],
    });
    const reasonCode = rcRes.body.data.code;

    const rmaRes = await request(app).post(`/api/rma/orders/${orderId}`).set('Cookie', studentCookie)
      .send({ reasonCode, reason: 'Package was damaged' });
    expect(rmaRes.status).toBe(201);
    const rmaId = rmaRes.body.data._id;

    // Admin approves the RMA
    const approveRes = await request(app)
      .post(`/api/rma/${rmaId}/approve`)
      .set('Cookie', adminCookie);
    expect(approveRes.status).toBe(200);
  });

  it('returns 403 for student trying to approve RMA', async () => {
    await usersService.createUser({
      username: 'rma_student_deny', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('rma_student_deny');
    const res = await request(app).post('/api/rma/fake-rma-id/approve').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
});
