/**
 * Integration tests for settings endpoints:
 * GET /api/settings, GET /api/settings/backup-destination, PUT /api/settings/backup-destination
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

describe('GET /api/settings', () => {
  it('admin can read settings', async () => {
    await usersService.createUser({
      username: 'set_admin_read', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('set_admin_read');
    const res = await request(app).get('/api/settings').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'set_student_read', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('set_student_read');
    const res = await request(app).get('/api/settings').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/settings/backup-destination', () => {
  it('admin can read backup destination', async () => {
    await usersService.createUser({
      username: 'set_admin_bkdst', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('set_admin_bkdst');
    const res = await request(app).get('/api/settings/backup-destination').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.destinationPath).toBeDefined();
  });
});

describe('PUT /api/settings/backup-destination', () => {
  it('admin can update backup destination', async () => {
    await usersService.createUser({
      username: 'set_admin_bkput', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('set_admin_bkput');

    const res = await request(app)
      .put('/api/settings/backup-destination')
      .set('Cookie', cookie)
      .send({ destinationPath: '/tmp/test-backups' });
    expect(res.status).toBe(200);
    expect(res.body.data.destinationPath).toBeDefined();
  });

  it('rejects empty destination path', async () => {
    await usersService.createUser({
      username: 'set_admin_bkempty', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('set_admin_bkempty');
    const res = await request(app)
      .put('/api/settings/backup-destination')
      .set('Cookie', cookie)
      .send({ destinationPath: '' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'set_student_bkput', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('set_student_bkput');
    const res = await request(app)
      .put('/api/settings/backup-destination')
      .set('Cookie', cookie)
      .send({ destinationPath: '/tmp/hack' });
    expect(res.status).toBe(403);
  });
});
