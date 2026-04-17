/**
 * Integration tests for auth lifecycle endpoints:
 * POST /api/auth/logout, POST /api/auth/change-password
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

describe('POST /api/auth/logout', () => {
  it('logs out authenticated user and clears cookie', async () => {
    await usersService.createUser({
      username: 'logout_user', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('logout_user');

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Logged out');

    // Cookie should be cleared — subsequent requests should fail
    const sessionRes = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(sessionRes.status).toBe(401);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('changes password and forces re-login', async () => {
    await usersService.createUser({
      username: 'chpw_user', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('chpw_user');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'TestPass1!@#', newPassword: 'NewPass2!@#$' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('Password changed');

    // Old password should no longer work
    const oldLoginRes = await request(app).post('/api/auth/login')
      .send({ username: 'chpw_user', password: 'TestPass1!@#' });
    expect(oldLoginRes.status).toBe(401);

    // New password should work
    const newLoginRes = await request(app).post('/api/auth/login')
      .send({ username: 'chpw_user', password: 'NewPass2!@#$' });
    expect(newLoginRes.status).toBe(200);
  });

  it('rejects when current password is wrong', async () => {
    await usersService.createUser({
      username: 'chpw_wrong', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('chpw_wrong');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'WrongPass999!', newPassword: 'NewPass2!@#$' });
    expect(res.status).toBe(401);
  });

  it('rejects weak new password', async () => {
    await usersService.createUser({
      username: 'chpw_weak', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('chpw_weak');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'TestPass1!@#', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .send({ currentPassword: 'x', newPassword: 'y' });
    expect(res.status).toBe(401);
  });
});
