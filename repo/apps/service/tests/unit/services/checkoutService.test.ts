import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
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

async function setupVendorAndItem(suffix: string, eligibleScopes: object[] = []) {
  const { _id: vendorId } = await vendorsService.createVendor({ name: `CO Vendor ${suffix}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId,
    name: `CO Item ${suffix}`,
    sku: `CO-${suffix}`,
    unitPrice: 50,
    currency: 'CNY',
    taxRate: 0.08,
    stock: 100,
    isAvailable: true,
    eligibleScopes: eligibleScopes as never,
  });
  return { item };
}

describe('checkoutService: POST /api/carts/checkout', () => {
  it('blacklisted user cannot checkout (USER_BLACKLISTED)', async () => {
    await usersService.createUser({
      username: 'co_admin_bl', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const student = await usersService.createUser({
      username: 'co_student_bl', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const { item } = await setupVendorAndItem('bl');

    const adminCookie = await login('co_admin_bl');
    const studentCookie = await login('co_student_bl');

    await request(app)
      .post('/api/carts/items')
      .set('Cookie', studentCookie)
      .send({ catalogItemId: item._id, quantity: 1 });

    await request(app)
      .post(`/api/users/${student._id}/blacklist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Repeated policy violations' });

    const res = await request(app)
      .post('/api/carts/checkout')
      .set('Cookie', studentCookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('USER_BLACKLISTED');
  });

  it('empty cart checkout fails (CART_EMPTY)', async () => {
    await usersService.createUser({
      username: 'co_student_empty', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('co_student_empty');

    const res = await request(app)
      .post('/api/carts/checkout')
      .set('Cookie', cookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  it('out-of-scope item inserted directly into DB is rejected at checkout (ITEM_OUT_OF_SCOPE)', async () => {
    const student = await usersService.createUser({
      username: 'co_student_scope', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'SCHOOL_A' },
    });
    const { item } = await setupVendorAndItem('scope', [{ school: 'SCHOOL_B' }]);

    const cookie = await login('co_student_scope');

    const cartId = randomUUID();
    await getDb().collection('carts').insertOne({
      _id: cartId,
      userId: student._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await getDb().collection('cart_items').insertOne({
      _id: randomUUID(),
      cartId,
      catalogItemId: item._id,
      quantity: 1,
      addedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/carts/checkout')
      .set('Cookie', cookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ITEM_OUT_OF_SCOPE');
  });

  it('successful checkout creates an order in submitted state', async () => {
    const { item } = await setupVendorAndItem('success');
    await usersService.createUser({
      username: 'co_student_ok', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('co_student_ok');

    await request(app)
      .post('/api/carts/items')
      .set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 2 });

    const res = await request(app)
      .post('/api/carts/checkout')
      .set('Cookie', cookie);

    expect(res.status).toBe(201);
    expect(res.body.data.state).toBe('submitted');
    expect(res.body.data.orderNumber).toMatch(/^NO-/);
  });
});
