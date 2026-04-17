/**
 * Integration tests for object-level scope isolation on order detail/notes/tags routes.
 * Covers the security gap identified in the static audit: advisors and mentors
 * could previously access any order by ID without per-object scope checks.
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

async function setupItem() {
  const vendor = await vendorsService.createVendor({ name: 'Scope Test Vendor', isActive: true });
  return catalogService.createItem({
    vendorId: vendor._id, name: 'Scope Item', sku: 'SCO-001',
    unitPrice: 10, currency: 'CNY', taxRate: 0.08, stock: 100,
    isAvailable: true, eligibleScopes: [],
  });
}

/**
 * Creates a student + advisor in the SAME school scope, submits a checkout order,
 * and returns the order ID and cookies for both.
 */
async function placeOrderForStudent(
  studentUsername: string,
  advisorUsername: string,
  school: string,
  suffix: string,
) {
  await usersService.createUser({
    username: studentUsername, password: 'TestPass1!@#', role: 'student',
    scope: { school },
  });
  await usersService.createUser({
    username: advisorUsername, password: 'TestPass1!@#', role: 'faculty_advisor',
    scope: { school },
  });

  const item = await setupItem();
  const studentCookie = await login(studentUsername);

  await request(app)
    .post('/api/carts/items')
    .set('Cookie', studentCookie)
    .send({ catalogItemId: item._id, quantity: 1 });

  const res = await request(app)
    .post('/api/carts/checkout')
    .set('Cookie', studentCookie);
  expect(res.status).toBe(201);

  return {
    orderId: (res.body.data as { _id: string })._id,
    studentCookie,
    advisorCookie: await login(advisorUsername),
  };
}

describe('Object-level scope isolation: GET /api/orders/:id', () => {
  it('advisor in the SAME scope CAN read the order', async () => {
    const { orderId, advisorCookie } = await placeOrderForStudent(
      'iso_student_same', 'iso_advisor_same', 'SCHOOL_A', 'sa',
    );
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', advisorCookie);
    expect(res.status).toBe(200);
  });

  it('advisor in a DIFFERENT scope gets 403', async () => {
    const { orderId } = await placeOrderForStudent(
      'iso_student_x', 'iso_advisor_x', 'SCHOOL_X', 'x',
    );

    // Advisor from a different school
    await usersService.createUser({
      username: 'iso_advisor_y', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'SCHOOL_Y' },
    });
    const otherAdvisorCookie = await login('iso_advisor_y');

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', otherAdvisorCookie);
    expect(res.status).toBe(403);
  });

  it('student gets 403 for another student\'s order', async () => {
    const { orderId } = await placeOrderForStudent(
      'iso_student_owner', 'iso_advisor_owner', 'SCHOOL_O', 'o',
    );

    await usersService.createUser({
      username: 'iso_student_other', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'SCHOOL_O' },
    });
    const otherStudentCookie = await login('iso_student_other');

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', otherStudentCookie);
    expect(res.status).toBe(403);
  });

  it('admin can access any order regardless of scope', async () => {
    const { orderId } = await placeOrderForStudent(
      'iso_student_admin_test', 'iso_advisor_admin_test', 'SCHOOL_ADMIN', 'at',
    );

    await usersService.createUser({
      username: 'iso_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const adminCookie = await login('iso_admin');

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });
});

describe('Object-level scope isolation: missing userScopeSnapshot', () => {
  it('advisor gets 403 for order without userScopeSnapshot', async () => {
    // Create an order directly in DB without userScopeSnapshot (simulating legacy/admin-created)
    const { getDb } = await import('../../../src/persistence/mongoClient.js');
    const { randomUUID } = await import('crypto');
    const orderId = randomUUID();
    await getDb().collection('orders').insertOne({
      _id: orderId,
      orderNumber: `TEST-NOSCOPE-${Date.now()}`,
      userId: 'some-other-user',
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 10,
      taxLines: [],
      taxTotal: 0,
      total: 10,
      currency: 'CNY',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      // intentionally no userScopeSnapshot
    });

    await usersService.createUser({
      username: 'noscope_advisor', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'SCHOOL_ANY' },
    });
    const advisorCookie = await login('noscope_advisor');

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', advisorCookie);
    expect(res.status).toBe(403);
  });

  it('admin can still access order without userScopeSnapshot', async () => {
    const { getDb } = await import('../../../src/persistence/mongoClient.js');
    const { randomUUID } = await import('crypto');
    const orderId = randomUUID();
    await getDb().collection('orders').insertOne({
      _id: orderId,
      orderNumber: `TEST-NOSCOPE-ADMIN-${Date.now()}`,
      userId: 'some-other-user',
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 10,
      taxLines: [],
      taxTotal: 0,
      total: 10,
      currency: 'CNY',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await usersService.createUser({
      username: 'noscope_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const adminCookie = await login('noscope_admin');

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });
});

describe('Object-level scope isolation: POST /api/orders/:id/notes', () => {
  it('advisor in DIFFERENT scope cannot add notes', async () => {
    const { orderId } = await placeOrderForStudent(
      'note_student_x', 'note_advisor_x', 'SCHOOL_NX', 'nx',
    );

    await usersService.createUser({
      username: 'note_advisor_y', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'SCHOOL_NY' },
    });
    const otherCookie = await login('note_advisor_y');

    const res = await request(app)
      .post(`/api/orders/${orderId}/notes`)
      .set('Cookie', otherCookie)
      .send({ content: 'Unauthorized note' });
    expect(res.status).toBe(403);
  });

  it('advisor in SAME scope CAN add notes', async () => {
    const { orderId, advisorCookie } = await placeOrderForStudent(
      'note_student_same', 'note_advisor_same', 'SCHOOL_NS', 'ns',
    );

    const res = await request(app)
      .post(`/api/orders/${orderId}/notes`)
      .set('Cookie', advisorCookie)
      .send({ content: 'Authorized note from advisor' });
    expect(res.status).toBe(201);
  });
});

describe('Object-level scope isolation: POST /api/orders/:id/tags', () => {
  it('student cannot tag another student\'s order', async () => {
    const { orderId } = await placeOrderForStudent(
      'tag_student_owner', 'tag_advisor_owner', 'SCHOOL_TO', 'to',
    );

    await usersService.createUser({
      username: 'tag_student_other', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'SCHOOL_TO' },
    });
    const otherCookie = await login('tag_student_other');

    const res = await request(app)
      .post(`/api/orders/${orderId}/tags`)
      .set('Cookie', otherCookie)
      .send({ tag: 'stolen-tag' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('advisor in SAME scope CAN tag an order and response contains the tag', async () => {
    const { orderId, advisorCookie } = await placeOrderForStudent(
      'tag_student_success', 'tag_advisor_success', 'SCHOOL_TS', 'ts',
    );

    const res = await request(app)
      .post(`/api/orders/${orderId}/tags`)
      .set('Cookie', advisorCookie)
      .send({ tag: 'priority-review' });
    expect(res.status).toBe(201);
    expect(res.body.data.tag).toBe('priority-review');
    expect(res.body.data.orderId).toBe(orderId);
  });

  it('admin can tag any order regardless of scope', async () => {
    const { orderId } = await placeOrderForStudent(
      'tag_student_admin', 'tag_advisor_admin', 'SCHOOL_TA', 'ta_tag',
    );

    await usersService.createUser({
      username: 'tag_admin_user', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const adminCookie = await login('tag_admin_user');

    const res = await request(app)
      .post(`/api/orders/${orderId}/tags`)
      .set('Cookie', adminCookie)
      .send({ tag: 'admin-flag' });
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
  });
});

// ─── Mentor object-level authorization: confirm-delivery ───────────────────
// Corporate mentors have the fulfillment:confirm_receipt permission globally,
// but must only confirm deliveries for orders within their scope.

async function placeOrderAndAdvanceToShipped(
  school: string,
  suffix: string,
) {
  const studentUsername = `ment_student_${suffix}`;
  const advisorUsername = `ment_advisor_${suffix}`;
  const adminUsername = `ment_admin_${suffix}`;

  await usersService.createUser({
    username: studentUsername, password: 'TestPass1!@#', role: 'student',
    scope: { school },
  });
  await usersService.createUser({
    username: advisorUsername, password: 'TestPass1!@#', role: 'faculty_advisor',
    scope: { school },
  });
  await usersService.createUser({
    username: adminUsername, password: 'TestPass1!@#', role: 'department_admin',
    scope: {},
  });

  const item = await setupItem();
  const studentCookie = await login(studentUsername);
  const advisorCookie = await login(advisorUsername);
  const adminCookie = await login(adminUsername);

  // Cart → checkout
  await request(app).post('/api/carts/items').set('Cookie', studentCookie)
    .send({ catalogItemId: item._id, quantity: 1 });
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);
  const orderId = (coRes.body.data as { _id: string })._id;

  // Approve
  await request(app).post(`/api/approvals/${orderId}/approve`)
    .set('Cookie', advisorCookie).send({ reason: 'ok' });

  // Confirm payment
  const intentCreateRes = await request(app).post('/api/payments/intents').set('Cookie', adminCookie).send({ orderId });
  const intentId = (intentCreateRes.body.data as { _id: string })._id;
  await request(app).post(`/api/payments/intents/${intentId}/confirm`)
    .set('Cookie', adminCookie).send({ paymentReference: 'REF-TEST' });

  // Allocate + ship (admin has orders:admin permission)
  await request(app).post(`/api/fulfillment/${orderId}/allocate`).set('Cookie', adminCookie);
  await request(app).post(`/api/fulfillment/${orderId}/ship`).set('Cookie', adminCookie)
    .send({ trackingNumber: 'TRK-001' });

  return { orderId, adminCookie };
}

describe('Mentor object-level authorization: confirm-delivery', () => {
  it('mentor in SAME school scope can confirm delivery', async () => {
    const { orderId } = await placeOrderAndAdvanceToShipped('SCHOOL_MENT_A', 'ma');

    await usersService.createUser({
      username: 'mentor_same_school', password: 'TestPass1!@#', role: 'corporate_mentor',
      scope: { school: 'SCHOOL_MENT_A' },
    });
    const mentorCookie = await login('mentor_same_school');

    const res = await request(app)
      .post(`/api/fulfillment/${orderId}/confirm-delivery`)
      .set('Cookie', mentorCookie)
      .send({ conditionNote: 'Good condition' });
    expect(res.status).toBe(200);
  });

  it('mentor in DIFFERENT school scope gets 403', async () => {
    const { orderId } = await placeOrderAndAdvanceToShipped('SCHOOL_MENT_B', 'mb');

    await usersService.createUser({
      username: 'mentor_diff_school', password: 'TestPass1!@#', role: 'corporate_mentor',
      scope: { school: 'SCHOOL_MENT_DIFFERENT' },
    });
    const wrongMentorCookie = await login('mentor_diff_school');

    const res = await request(app)
      .post(`/api/fulfillment/${orderId}/confirm-delivery`)
      .set('Cookie', wrongMentorCookie)
      .send({ conditionNote: 'Should be denied' });
    expect(res.status).toBe(403);
  });

  it('unauthenticated request gets 401', async () => {
    const { orderId } = await placeOrderAndAdvanceToShipped('SCHOOL_MENT_C', 'mc');
    const res = await request(app)
      .post(`/api/fulfillment/${orderId}/confirm-delivery`)
      .send({ conditionNote: 'No cookie' });
    expect(res.status).toBe(401);
  });
});
