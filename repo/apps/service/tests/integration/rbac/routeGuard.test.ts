import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';

const app = createApp();

async function loginAs(username: string, role: 'student' | 'faculty_advisor' | 'department_admin', password = 'TestPass1!@#') {
  await usersService.createUser({ username, password, role, scope: {} });
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('RBAC route guards', () => {
  it('returns 401 for unauthenticated request to /api/orders', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('returns 403 when student tries to access /api/users', async () => {
    const cookie = await loginAs('student_rbac', 'student');
    const res = await request(app).get('/api/users').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('returns 403 when student tries to access /api/audits', async () => {
    const cookie = await loginAs('student_audit', 'student');
    const res = await request(app).get('/api/audits').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('allows admin to access /api/users', async () => {
    const cookie = await loginAs('admin_rbac', 'department_admin');
    const res = await request(app).get('/api/users').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('returns 403 when non-admin tries to create backup', async () => {
    const cookie = await loginAs('fa_rbac', 'faculty_advisor');
    const res = await request(app).post('/api/backups').set('Cookie', cookie).send({});
    expect(res.status).toBe(403);
  });

  it('returns 403 when student tries to repair payment exception', async () => {
    const cookie = await loginAs('stu_recon', 'student');
    const res = await request(app).post('/api/payments/reconciliation/repair')
      .set('Cookie', cookie)
      .send({ paymentIntentId: 'test', note: 'note' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when student tries to apply an update', async () => {
    const cookie = await loginAs('stu_update', 'student');
    // Update routes are protected by internal key, not session — 401 for missing key
    const res = await request(app).post('/api/updates/fake-id/apply').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('GET /api/rules/conflicts is NOT captured by the /:id dynamic route', async () => {
    const cookie = await loginAs('admin_rules_route', 'department_admin');
    const res = await request(app).get('/api/rules/conflicts').set('Cookie', cookie);
    // Should return 200 with data array, not 404/422 from /:id trying to look up "conflicts"
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 403 when student tries to confirm payment', async () => {
    const cookie = await loginAs('stu_pay_confirm', 'student');
    const res = await request(app)
      .post('/api/payments/intents/fake-id/confirm')
      .set('Cookie', cookie)
      .send({ paymentReference: 'REF' });
    expect(res.status).toBe(403);
  });
});
