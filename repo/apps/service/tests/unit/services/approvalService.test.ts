/**
 * Unit tests for approvalService business logic.
 * Tests decision handling (approve/deny) and scope validation.
 */
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

async function placeOrder(suffix: string) {
  await usersService.createUser({
    username: `appr_svc_stu_${suffix}`, password: 'TestPass1!@#', role: 'student',
    scope: { school: 'APPR_SVC' },
  });
  const vendor = await vendorsService.createVendor({ name: `Appr Svc Vendor ${suffix}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId: vendor._id, name: 'Appr Svc Item', sku: `AS-${suffix}`,
    unitPrice: 30, currency: 'CNY', taxRate: 0.08, stock: 50,
    isAvailable: true, eligibleScopes: [],
  });
  const cookie = await login(`appr_svc_stu_${suffix}`);
  await request(app).post('/api/carts/items').set('Cookie', cookie)
    .send({ catalogItemId: item._id, quantity: 1 });
  const coRes = await request(app).post('/api/carts/checkout').set('Cookie', cookie);
  return (coRes.body.data as { _id: string })._id;
}

describe('approvalService via integration', () => {
  it('approve transitions order from submitted to approved', async () => {
    await usersService.createUser({
      username: 'appr_svc_adv1', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'APPR_SVC' },
    });
    const orderId = await placeOrder('appr1');
    const advCookie = await login('appr_svc_adv1');

    const res = await request(app).post(`/api/approvals/${orderId}/approve`).set('Cookie', advCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('approved');

    const order = await orderRepository.findById(orderId);
    expect(order.state).toBe('approved');
  });

  it('deny transitions order from submitted to cancelled', async () => {
    await usersService.createUser({
      username: 'appr_svc_adv2', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'APPR_SVC' },
    });
    const orderId = await placeOrder('deny1');
    const advCookie = await login('appr_svc_adv2');

    const res = await request(app).post(`/api/approvals/${orderId}/reject`).set('Cookie', advCookie)
      .send({ reason: 'Over budget' });
    expect(res.status).toBe(200);

    const order = await orderRepository.findById(orderId);
    expect(order.state).toBe('cancelled');
  });

  it('cannot approve an already-approved order', async () => {
    await usersService.createUser({
      username: 'appr_svc_adv3', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'APPR_SVC' },
    });
    const orderId = await placeOrder('double1');
    const advCookie = await login('appr_svc_adv3');

    await request(app).post(`/api/approvals/${orderId}/approve`).set('Cookie', advCookie);
    // Second approval should fail — order is now in 'approved' state
    const res = await request(app).post(`/api/approvals/${orderId}/approve`).set('Cookie', advCookie);
    expect(res.status).toBe(422);
  });
});
