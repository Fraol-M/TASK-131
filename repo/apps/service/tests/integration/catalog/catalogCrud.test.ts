/**
 * Integration tests for catalog CRUD endpoints:
 * POST /api/catalog, GET /api/catalog/:id, PATCH /api/catalog/:id
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupAdmin(suffix: string) {
  await usersService.createUser({
    username: `cat_admin_${suffix}`, password: 'TestPass1!@#', role: 'department_admin', scope: {},
  });
  return login(`cat_admin_${suffix}`);
}

async function setupStudent(suffix: string) {
  await usersService.createUser({
    username: `cat_student_${suffix}`, password: 'TestPass1!@#', role: 'student', scope: { school: 'CAT_SCHOOL' },
  });
  return login(`cat_student_${suffix}`);
}

describe('POST /api/catalog', () => {
  it('admin can create a catalog item', async () => {
    const adminCookie = await setupAdmin('create1');
    const vendor = await vendorsService.createVendor({ name: 'Cat Create Vendor', isActive: true });

    const res = await request(app).post('/api/catalog').set('Cookie', adminCookie).send({
      vendorId: vendor._id, name: 'New Textbook', sku: 'CAT-NEW-001',
      unitPrice: 45, currency: 'CNY', taxRate: 0.08, stock: 50,
      isAvailable: true, eligibleScopes: [],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('New Textbook');
    expect(res.body.data._id).toBeDefined();
  });

  it('returns 403 for student', async () => {
    const studentCookie = await setupStudent('create2');
    const res = await request(app).post('/api/catalog').set('Cookie', studentCookie).send({
      vendorId: 'x', name: 'Hack Item', sku: 'HACK',
      unitPrice: 10, currency: 'CNY', taxRate: 0, stock: 1,
    });
    expect(res.status).toBe(403);
  });

  it('rejects invalid payload (missing required fields)', async () => {
    const adminCookie = await setupAdmin('create3');
    const res = await request(app).post('/api/catalog').set('Cookie', adminCookie).send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/catalog/:id', () => {
  it('returns a single catalog item by ID', async () => {
    const adminCookie = await setupAdmin('getid1');
    const vendor = await vendorsService.createVendor({ name: 'Cat GetId Vendor', isActive: true });

    const createRes = await request(app).post('/api/catalog').set('Cookie', adminCookie).send({
      vendorId: vendor._id, name: 'Specific Item', sku: 'CAT-GET-001',
      unitPrice: 30, currency: 'CNY', taxRate: 0.08, stock: 20,
      isAvailable: true, eligibleScopes: [],
    });
    const itemId = createRes.body.data._id;

    const res = await request(app).get(`/api/catalog/${itemId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Specific Item');
  });

  it('returns 404 for non-existent item', async () => {
    const adminCookie = await setupAdmin('getid2');
    const res = await request(app).get('/api/catalog/nonexistent-id').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/catalog/:id', () => {
  it('admin can update a catalog item', async () => {
    const adminCookie = await setupAdmin('patch1');
    const vendor = await vendorsService.createVendor({ name: 'Cat Patch Vendor', isActive: true });

    const createRes = await request(app).post('/api/catalog').set('Cookie', adminCookie).send({
      vendorId: vendor._id, name: 'Patchable Item', sku: 'CAT-PATCH-001',
      unitPrice: 20, currency: 'CNY', taxRate: 0.08, stock: 10,
      isAvailable: true, eligibleScopes: [],
    });
    const itemId = createRes.body.data._id;

    const res = await request(app).patch(`/api/catalog/${itemId}`).set('Cookie', adminCookie)
      .send({ unitPrice: 35, name: 'Updated Item' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Item');
    expect(res.body.data.unitPrice).toBe(35);
  });

  it('returns 403 for student', async () => {
    const studentCookie = await setupStudent('patch2');
    const res = await request(app).patch('/api/catalog/some-id').set('Cookie', studentCookie)
      .send({ unitPrice: 999 });
    expect(res.status).toBe(403);
  });
});
