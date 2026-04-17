/**
 * Integration tests for the update import -> apply business-state lifecycle.
 * Covers the audit gap: previous tests focused on auth gates only.
 * Tests the full happy path through import and apply stages.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
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

describe('Update import + apply lifecycle', () => {
  it('admin can import an update package and it is staged', async () => {
    const admin = await usersService.createUser({
      username: 'upd_apply_admin1', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('upd_apply_admin1');

    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .attach('package', Buffer.from('PK\x03\x04fake-zip-content-for-test'), 'update-v2.zip')
      .field('version', '2.0.0');

    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe('2.0.0');
    expect(res.body.data.status).toBe('staged');
    expect(res.body.data.checksum).toBeDefined();
    expect(res.body.data._id).toBeDefined();

    // Verify in DB
    const pkg = await getDb().collection('update_packages').findOne({ _id: res.body.data._id } as { _id: string });
    expect(pkg).not.toBeNull();
    expect(pkg!.status).toBe('staged');
    expect(pkg!.importedBy).toBe(admin._id);
  });

  it('apply rejects a non-existent package ID', async () => {
    await usersService.createUser({
      username: 'upd_apply_admin2', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('upd_apply_admin2');

    const res = await request(app)
      .post(`/api/updates/${randomUUID()}/apply`)
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('apply rejects a package that is not in staged status', async () => {
    await usersService.createUser({
      username: 'upd_apply_admin3', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('upd_apply_admin3');

    // Insert a package already in 'applied' state
    const pkgId = randomUUID();
    await getDb().collection('update_packages').insertOne({
      _id: pkgId,
      filename: 'already-applied.zip',
      version: '1.5.0',
      checksum: 'abc123',
      importedBy: 'test',
      importedAt: new Date(),
      status: 'applied',
    });

    const res = await request(app)
      .post(`/api/updates/${pkgId}/apply`)
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie);

    expect(res.status).toBe(500); // applyPackage throws Error for wrong status
  });

  it('successful apply marks package as applied and returns applied status', async () => {
    const admin = await usersService.createUser({
      username: 'upd_apply_admin5', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('upd_apply_admin5');

    // Create a valid ZIP containing the expected entry point dist/server.js
    const zip = new AdmZip();
    zip.addFile('dist/server.js', Buffer.from('// minimal server entry for test'));
    const zipBuffer = zip.toBuffer();

    // Stage the package
    const importRes = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .attach('package', zipBuffer, 'update-v5.0.0.zip')
      .field('version', '5.0.0');

    expect(importRes.status).toBe(201);
    const packageId = (importRes.body.data as { _id: string })._id;

    // Apply the staged package
    const applyRes = await request(app)
      .post(`/api/updates/${packageId}/apply`)
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie);

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.data.status).toBe('applied');
    expect(applyRes.body.data._id).toBe(packageId);

    // DB should reflect applied state
    const pkg = await getDb().collection('update_packages').findOne({ _id: packageId } as { _id: string });
    expect(pkg?.status).toBe('applied');
    expect(pkg?.appliedBy).toBe(admin._id);
  });

  it('import records an audit event', async () => {
    await usersService.createUser({
      username: 'upd_apply_admin4', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('upd_apply_admin4');

    const res = await request(app)
      .post('/api/updates/import')
      .set('x-internal-key', VALID_KEY)
      .set('Cookie', cookie)
      .attach('package', Buffer.from('PK\x03\x04test-content'), 'update-v3.zip')
      .field('version', '3.0.0');

    expect(res.status).toBe(201);

    // Check audit event was recorded
    const audit = await getDb().collection('order_audit_events')
      .findOne({ action: 'update.imported' });
    expect(audit).not.toBeNull();
  });
});
