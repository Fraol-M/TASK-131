/**
 * Integration tests for update import/apply/rollback authorization.
 * Covers the gap identified in the recheck: no dedicated test suite existed
 * for the update routes and their internal-key + role guard enforcement.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';

const app = createApp();

const VALID_KEY = process.env['INTERNAL_API_KEY'] ?? 'test-internal-key';

async function loginAs(username: string, role: 'student' | 'faculty_advisor' | 'department_admin', password = 'TestPass1!@#') {
  await usersService.createUser({ username, password, role, scope: {} });
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('Update import route authorization', () => {
  it('returns 401 when internal key is missing', async () => {
    const res = await request(app)
      .post('/api/updates/import')
      .attach('package', Buffer.from('fake-zip-content'), 'update.zip')
      .field('version', '1.1.0');
    expect(res.status).toBe(401);
  });

  it('returns 401 when internal key is wrong', async () => {
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', 'wrong-key')
      .attach('package', Buffer.from('fake-zip-content'), 'update.zip')
      .field('version', '1.1.0');
    expect(res.status).toBe(401);
  });

  it('returns 403 for import with internal key but no session (privilege boundary)', async () => {
    // The internal key alone is not sufficient — an admin session must accompany it.
    // This is the security boundary the Blocker issue required enforcing.
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .attach('package', Buffer.from('fake'), 'update.zip')
      .field('version', '1.0.0');
    expect(res.status).toBe(403);
  });

  it('returns 400 when no file is attached (admin session + key valid)', async () => {
    const cookie = await loginAs('upd_admin_nofile', 'department_admin');
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .field('version', '1.1.0');
    expect(res.status).toBe(400);
  });

  it('accepts import with valid internal key, admin session, and file', async () => {
    const cookie = await loginAs('upd_admin_import', 'department_admin');
    // A minimal ZIP file (PK header only) — enough for import staging.
    const minimalZip = Buffer.from('504b0506' + '0'.repeat(36), 'hex');
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .attach('package', minimalZip, 'v1.1.0.zip')
      .field('version', '1.1.0');
    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe('1.1.0');
    expect(res.body.data.status).toBe('staged');
    expect(res.body.data.checksum).toBeTruthy();
  });

  it('returns 403 when a non-admin session accompanies the internal key', async () => {
    const cookie = await loginAs('upd_student', 'student');
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .attach('package', Buffer.from('fake'), 'update.zip')
      .field('version', '1.0.0');
    expect(res.status).toBe(403);
  });

  it('allows admin session with valid internal key', async () => {
    const cookie = await loginAs('upd_admin', 'department_admin');
    const minimalZip = Buffer.from('504b0506' + '0'.repeat(36), 'hex');
    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .attach('package', minimalZip, 'admin-import.zip')
      .field('version', '2.0.0');
    expect(res.status).toBe(201);
  });
});

describe('Update apply route authorization', () => {
  it('returns 401 when internal key is missing', async () => {
    const res = await request(app).post('/api/updates/fake-id/apply');
    expect(res.status).toBe(401);
  });

  it('returns 403 for apply with internal key but no session (privilege boundary)', async () => {
    const res = await request(app)
      .post('/api/updates/some-pkg-id/apply')
      .set('x-internal-key', VALID_KEY);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent package (admin session + key valid)', async () => {
    const cookie = await loginAs('upd_admin_apply', 'department_admin');
    const res = await request(app)
      .post('/api/updates/nonexistent-package-id/apply')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 403 when non-admin session accompanies the key', async () => {
    const cookie = await loginAs('upd_advisor_apply', 'faculty_advisor');
    const res = await request(app)
      .post('/api/updates/some-pkg-id/apply')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
});

describe('Update rollback route authorization', () => {
  it('returns 401 when internal key is missing', async () => {
    const res = await request(app)
      .post('/api/updates/rollback')
      .send({ updatePackageId: 'fake', reason: 'test' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when student session accompanies the key', async () => {
    const cookie = await loginAs('upd_student_rb', 'student');
    const res = await request(app)
      .post('/api/updates/rollback')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .send({ updatePackageId: 'fake', reason: 'test' });
    expect(res.status).toBe(403);
  });
});

describe('Auto-rollback route authorization', () => {
  it('returns 401 when internal key is missing', async () => {
    const res = await request(app)
      .post('/api/updates/auto-rollback')
      .send({ reason: 'health_check_failure' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with a no-op message when no applied package exists', async () => {
    const res = await request(app)
      .post('/api/updates/auto-rollback')
      .set('x-internal-key', VALID_KEY)
      .send({ reason: 'startup_health_check_failure' });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.message).toMatch(/no applied package/i);
  });

  it('rolls back and returns a rollback event when an applied package exists', async () => {
    const pkgId = randomUUID();
    await getDb().collection('update_packages').insertOne({
      _id: pkgId,
      filename: 'auto-rb-test.zip',
      version: '9.9.9',
      checksum: 'abc',
      importedBy: 'test',
      importedAt: new Date(),
      appliedBy: 'test',
      appliedAt: new Date(),
      status: 'applied',
    });

    const res = await request(app)
      .post('/api/updates/auto-rollback')
      .set('x-internal-key', VALID_KEY)
      .send({ reason: 'startup_health_check_failure' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    // Should return a rollback event, not the no-op message
    expect(res.body.data.message).toBeUndefined();
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.trigger).toBe('health_check_failure');

    // Package should be marked rolled_back
    const updated = await getDb().collection('update_packages').findOne({ _id: pkgId } as { _id: string });
    expect(updated?.status).toBe('rolled_back');
  });
});
