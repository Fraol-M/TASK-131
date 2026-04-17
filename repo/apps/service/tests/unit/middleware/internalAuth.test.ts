import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { config } from '../../../src/config/index.js';

const app = createApp();
const VALID_KEY = config.internal.apiKey;

async function loginAsAdmin(username: string, password = 'TestPass1!@#') {
  await usersService.createUser({ username, password, role: 'department_admin', scope: {} });
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('internalAuthMiddleware: POST /api/updates/import', () => {
  it('returns 401 when x-internal-key header is missing', async () => {
    const res = await request(app)
      .post('/api/updates/import')
      .attach('package', Buffer.from('fake'), 'update.zip')
      .field('version', '1.0.0');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when x-internal-key value is wrong', async () => {
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', 'not-the-right-key')
      .attach('package', Buffer.from('fake'), 'update.zip')
      .field('version', '1.0.0');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when correct x-internal-key is provided but no admin session', async () => {
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .attach('package', Buffer.from('fake'), 'update.zip')
      .field('version', '1.0.0');

    expect(res.status).toBe(403);
  });

  it('returns 400 when correct x-internal-key + valid admin session but no file (auth passed)', async () => {
    const cookie = await loginAsAdmin('iauth_admin_nofile');

    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .field('version', '1.0.0');

    expect(res.status).toBe(400);
  });
});
