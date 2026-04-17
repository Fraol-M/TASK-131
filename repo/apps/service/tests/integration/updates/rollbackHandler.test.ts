/**
 * Integration test proving POST /api/updates/rollback handler is reached
 * and processes a rollback request.
 * Addresses the audit gap: previous tests only asserted 401/403 guard behavior.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';

const app = createApp();
const VALID_KEY = process.env['INTERNAL_API_KEY'] ?? 'test-internal-key';

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('POST /api/updates/rollback (handler-path)', () => {
  it('admin with internal key can trigger a manual rollback', async () => {
    await usersService.createUser({
      username: 'rb_handler_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('rb_handler_admin');

    // Insert a staged update package directly so the rollback has a target
    const pkgId = randomUUID();
    await getDb().collection('update_packages').insertOne({
      _id: pkgId,
      filename: 'test-update.zip',
      version: '2.0.0',
      checksum: 'abc123',
      importedBy: 'test',
      importedAt: new Date(),
      status: 'applied',
    });

    const res = await request(app)
      .post('/api/updates/rollback')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .send({ updatePackageId: pkgId, reason: 'Integration test rollback' });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.trigger).toBe('manual');
    expect(res.body.data.status).toBe('completed');

    // Verify the package was marked as rolled_back
    const pkg = await getDb().collection('update_packages').findOne({ _id: pkgId } as { _id: string });
    expect(pkg!.status).toBe('rolled_back');
    expect(pkg!.rollbackReason).toBe('Integration test rollback');
  });

  it('rollback records a rollback_event in the database', async () => {
    await usersService.createUser({
      username: 'rb_handler_admin2', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('rb_handler_admin2');

    const pkgId = randomUUID();
    await getDb().collection('update_packages').insertOne({
      _id: pkgId,
      filename: 'test-update-2.zip',
      version: '3.0.0',
      checksum: 'def456',
      importedBy: 'test',
      importedAt: new Date(),
      status: 'applied',
    });

    await request(app)
      .post('/api/updates/rollback')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .send({ updatePackageId: pkgId, reason: 'Verify DB event' });

    const event = await getDb().collection('rollback_events')
      .findOne({ updatePackageId: pkgId });
    expect(event).not.toBeNull();
    expect(event!.trigger).toBe('manual');
  });
});
