/**
 * Integration tests for vendor endpoints:
 * GET /api/vendors, POST /api/vendors, GET /api/vendors/:id
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('GET /api/vendors', () => {
  it('admin can list vendors', async () => {
    await usersService.createUser({
      username: 'vend_admin_list', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('vend_admin_list');
    const res = await request(app).get('/api/vendors').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/vendors');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/vendors', () => {
  it('admin can create a vendor', async () => {
    await usersService.createUser({
      username: 'vend_admin_create', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('vend_admin_create');

    const res = await request(app).post('/api/vendors').set('Cookie', cookie).send({
      name: 'Test Vendor Co', isActive: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Vendor Co');
    expect(res.body.data._id).toBeDefined();
  });

  it('rejects invalid payload (missing name)', async () => {
    await usersService.createUser({
      username: 'vend_admin_invalid', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('vend_admin_invalid');
    const res = await request(app).post('/api/vendors').set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/vendors/:id', () => {
  it('returns a single vendor by ID', async () => {
    await usersService.createUser({
      username: 'vend_admin_getid', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('vend_admin_getid');

    const createRes = await request(app).post('/api/vendors').set('Cookie', cookie)
      .send({ name: 'Specific Vendor', isActive: true });
    const vendorId = createRes.body.data._id;

    const res = await request(app).get(`/api/vendors/${vendorId}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Specific Vendor');
  });

  it('returns 404 for non-existent vendor', async () => {
    await usersService.createUser({
      username: 'vend_admin_404', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('vend_admin_404');
    const res = await request(app).get('/api/vendors/nonexistent-id').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
