import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';

const app = createApp();

async function createTestUser(username: string, password = 'TestPass1!@#') {
  return usersService.createUser({ username, password, role: 'student', scope: {} });
}

describe('POST /api/auth/login', () => {
  it('returns session on valid credentials', async () => {
    await createTestUser('loginuser1');
    const res = await request(app).post('/api/auth/login').send({ username: 'loginuser1', password: 'TestPass1!@#' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.user.username).toBe('loginuser1');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on invalid password', async () => {
    await createTestUser('loginuser2');
    const res = await request(app).post('/api/auth/login').send({ username: 'loginuser2', password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_FAILED');
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'TestPass1!@#' });
    expect(res.status).toBe(401);
  });

  it('locks out user after 5 failed attempts', async () => {
    await createTestUser('lockoutuser');
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ username: 'lockoutuser', password: 'WrongPass1!' });
    }
    const res = await request(app).post('/api/auth/login').send({ username: 'lockoutuser', password: 'WrongPass1!' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_LOCKED');
  });

  it('allows login after successful attempt clears failed count', async () => {
    await createTestUser('resetuser');
    await request(app).post('/api/auth/login').send({ username: 'resetuser', password: 'Wrong1!' });
    const res = await request(app).post('/api/auth/login').send({ username: 'resetuser', password: 'TestPass1!@#' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/session', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(401);
  });

  it('returns session data when authenticated', async () => {
    await createTestUser('sessionuser');
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'sessionuser', password: 'TestPass1!@#' });
    const cookie = (loginRes.headers['set-cookie'] as string[]).join('; ');
    const res = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.user.role).toBe('student');
  });
});
