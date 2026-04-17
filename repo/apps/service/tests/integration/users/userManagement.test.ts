/**
 * Integration tests for user management endpoints:
 * POST /api/users, POST /api/users/:id/blacklist, DELETE /api/users/:id/blacklist
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

async function setupAdmin(suffix: string) {
  await usersService.createUser({
    username: `usr_admin_${suffix}`, password: 'TestPass1!@#', role: 'department_admin', scope: {},
  });
  return login(`usr_admin_${suffix}`);
}

describe('POST /api/users', () => {
  it('admin can create a new user', async () => {
    const adminCookie = await setupAdmin('create1');
    const res = await request(app).post('/api/users').set('Cookie', adminCookie).send({
      username: 'new_student_user', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'NEW_SCHOOL' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe('new_student_user');
    expect(res.body.data.role).toBe('student');
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'usr_student_create', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const studentCookie = await login('usr_student_create');
    const res = await request(app).post('/api/users').set('Cookie', studentCookie).send({
      username: 'hacked_user', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    expect(res.status).toBe(403);
  });

  it('rejects weak password', async () => {
    const adminCookie = await setupAdmin('create2');
    const res = await request(app).post('/api/users').set('Cookie', adminCookie).send({
      username: 'weak_pw_user', password: 'short', role: 'student', scope: {},
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/users').send({
      username: 'no_auth_user', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/:id/blacklist', () => {
  it('admin can blacklist a user', async () => {
    const adminCookie = await setupAdmin('bl1');
    const target = await usersService.createUser({
      username: 'bl_target1', password: 'TestPass1!@#', role: 'student', scope: {},
    });

    const res = await request(app)
      .post(`/api/users/${target._id}/blacklist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Policy violation' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('blacklisted');
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'bl_student_attacker', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const studentCookie = await login('bl_student_attacker');
    const res = await request(app)
      .post('/api/users/some-id/blacklist')
      .set('Cookie', studentCookie)
      .send({ reason: 'test' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/users/:id/blacklist', () => {
  it('admin can remove a user from blacklist', async () => {
    const adminCookie = await setupAdmin('unbl1');
    const target = await usersService.createUser({
      username: 'unbl_target1', password: 'TestPass1!@#', role: 'student', scope: {},
    });

    // Blacklist first
    await request(app).post(`/api/users/${target._id}/blacklist`)
      .set('Cookie', adminCookie).send({ reason: 'temp block' });

    // Remove from blacklist
    const res = await request(app)
      .delete(`/api/users/${target._id}/blacklist`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('removed from blacklist');
  });

  it('returns 403 for non-admin', async () => {
    await usersService.createUser({
      username: 'unbl_student', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const studentCookie = await login('unbl_student');
    const res = await request(app).delete('/api/users/some-id/blacklist').set('Cookie', studentCookie);
    expect(res.status).toBe(403);
  });
});
