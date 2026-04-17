/**
 * Integration test proving the GET /api/orders handler is reached and returns data.
 * Addresses the audit gap: previous tests only asserted 401 guard behavior.
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

describe('GET /api/orders (handler-path)', () => {
  it('student gets own orders (empty initially)', async () => {
    await usersService.createUser({
      username: 'ordlist_student1', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('ordlist_student1');
    const res = await request(app).get('/api/orders').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('student sees own order after checkout', async () => {
    await usersService.createUser({
      username: 'ordlist_student2', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('ordlist_student2');

    const vendor = await vendorsService.createVendor({ name: 'OrdList Vendor', isActive: true });
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'OrdList Item', sku: 'OL-001',
      unitPrice: 25, currency: 'CNY', taxRate: 0.08, stock: 50,
      isAvailable: true, eligibleScopes: [],
    });

    await request(app).post('/api/carts/items').set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    await request(app).post('/api/carts/checkout').set('Cookie', cookie);

    const res = await request(app).get('/api/orders').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].state).toBe('submitted');
    expect(res.body.data[0].itemCount).toBe(1);
  });

  it('advisor gets scope-filtered orders with itemCount', async () => {
    await usersService.createUser({
      username: 'ordlist_student3', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'ORDLIST_SCHOOL' },
    });
    await usersService.createUser({
      username: 'ordlist_advisor', password: 'TestPass1!@#', role: 'faculty_advisor',
      scope: { school: 'ORDLIST_SCHOOL' },
    });

    const studentCookie = await login('ordlist_student3');
    const vendor = await vendorsService.createVendor({ name: 'OrdList Vendor 2', isActive: true });
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'OrdList Item 2', sku: 'OL-002',
      unitPrice: 30, currency: 'CNY', taxRate: 0.08, stock: 50,
      isAvailable: true, eligibleScopes: [],
    });

    await request(app).post('/api/carts/items').set('Cookie', studentCookie)
      .send({ catalogItemId: item._id, quantity: 2 });
    await request(app).post('/api/carts/checkout').set('Cookie', studentCookie);

    const advisorCookie = await login('ordlist_advisor');
    const res = await request(app).get('/api/orders').set('Cookie', advisorCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].itemCount).toBeDefined();
    expect(typeof res.body.data[0].itemCount).toBe('number');
  });

  it('admin gets all orders', async () => {
    await usersService.createUser({
      username: 'ordlist_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('ordlist_admin');
    const res = await request(app).get('/api/orders').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
