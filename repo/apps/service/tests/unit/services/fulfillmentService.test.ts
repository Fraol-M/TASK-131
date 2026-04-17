import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';
import { orderRepository } from '../../../src/modules/orders/orderRepository.js';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function buildPaidOrder(suffix: string): Promise<string> {
  await usersService.createUser({
    username: `ff_stu_${suffix}`, password: 'TestPass1!@#', role: 'student',
    scope: { school: 'FULFILL_SCH' },
  });
  await usersService.createUser({
    username: `ff_adv_${suffix}`, password: 'TestPass1!@#', role: 'faculty_advisor',
    scope: { school: 'FULFILL_SCH' },
  });
  await usersService.createUser({
    username: `ff_adm_${suffix}`, password: 'TestPass1!@#', role: 'department_admin',
    scope: {},
  });

  const vendor = await vendorsService.createVendor({ name: `FF Vendor ${suffix}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId: vendor._id, name: 'FF Item', sku: `FF-${suffix}`,
    unitPrice: 50, currency: 'CNY', taxRate: 0.08, stock: 100,
    isAvailable: true, eligibleScopes: [],
  });

  const stuCookie = await login(`ff_stu_${suffix}`);
  const advCookie = await login(`ff_adv_${suffix}`);
  const admCookie = await login(`ff_adm_${suffix}`);

  await request(app).post('/api/carts/items').set('Cookie', stuCookie)
    .send({ catalogItemId: item._id, quantity: 1 });
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', stuCookie);
  const orderId = (coRes.body.data as { _id: string })._id;

  await request(app).post(`/api/approvals/${orderId}/approve`).set('Cookie', advCookie);

  const intentRes = await request(app).post('/api/payments/intents').set('Cookie', admCookie)
    .send({ orderId });
  const intentId = (intentRes.body.data as { _id: string })._id;

  await request(app).post(`/api/payments/intents/${intentId}/confirm`).set('Cookie', admCookie)
    .send({ paymentReference: `PAY-REF-${suffix}` });

  return orderId;
}

describe('fulfillmentService via integration', () => {
  it('admin can allocate a paid order', async () => {
    const orderId = await buildPaidOrder('alloc1');
    const admCookie = await login('ff_adm_alloc1');

    const res = await request(app).post(`/api/fulfillment/${orderId}/allocate`).set('Cookie', admCookie);
    expect(res.status).toBe(200);

    const order = await orderRepository.findById(orderId);
    expect(order.state).toBe('allocated');
  });

  it('admin can ship an allocated order', async () => {
    const orderId = await buildPaidOrder('ship1');
    const admCookie = await login('ff_adm_ship1');

    await request(app).post(`/api/fulfillment/${orderId}/allocate`).set('Cookie', admCookie);

    const res = await request(app).post(`/api/fulfillment/${orderId}/ship`).set('Cookie', admCookie)
      .send({ trackingNumber: 'TRK-001', carrier: 'FedEx' });
    expect(res.status).toBe(200);
    expect(res.body.data.trackingNumber).toBe('TRK-001');
    expect(res.body.data.carrier).toBe('FedEx');
    expect(res.body.data.orderId).toBe(orderId);
  });

  it('mentor in same scope can confirm delivery of a shipped order', async () => {
    const orderId = await buildPaidOrder('dlvr1');
    const admCookie = await login('ff_adm_dlvr1');

    await usersService.createUser({
      username: 'ff_mentor_dlvr1', password: 'TestPass1!@#', role: 'corporate_mentor',
      scope: { school: 'FULFILL_SCH' },
    });
    const mentorCookie = await login('ff_mentor_dlvr1');

    await request(app).post(`/api/fulfillment/${orderId}/allocate`).set('Cookie', admCookie);
    await request(app).post(`/api/fulfillment/${orderId}/ship`).set('Cookie', admCookie)
      .send({ trackingNumber: 'TRK-002', carrier: 'UPS' });

    const res = await request(app).post(`/api/fulfillment/${orderId}/confirm-delivery`).set('Cookie', mentorCookie);
    expect(res.status).toBe(200);

    const order = await orderRepository.findById(orderId);
    expect(order.state).toBe('delivered');
  });

  it('mentor in different scope gets 403 on confirm-delivery', async () => {
    const orderId = await buildPaidOrder('scope1');
    const admCookie = await login('ff_adm_scope1');

    await usersService.createUser({
      username: 'ff_mentor_other', password: 'TestPass1!@#', role: 'corporate_mentor',
      scope: { school: 'OTHER_SCHOOL' },
    });
    const wrongMentorCookie = await login('ff_mentor_other');

    await request(app).post(`/api/fulfillment/${orderId}/allocate`).set('Cookie', admCookie);
    await request(app).post(`/api/fulfillment/${orderId}/ship`).set('Cookie', admCookie)
      .send({ trackingNumber: 'TRK-003', carrier: 'DHL' });

    const res = await request(app).post(`/api/fulfillment/${orderId}/confirm-delivery`).set('Cookie', wrongMentorCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
