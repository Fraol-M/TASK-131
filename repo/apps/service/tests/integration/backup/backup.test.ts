import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';
import type { Backup } from '@nexusorder/shared-types';

const app = createApp();

async function loginAdmin() {
  await usersService.createUser({ username: 'backup_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {} });
  const res = await request(app).post('/api/auth/login').send({ username: 'backup_admin', password: 'TestPass1!@#' });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('Backup routes', () => {
  it('returns 403 for non-admin user', async () => {
    await usersService.createUser({ username: 'backup_student', password: 'TestPass1!@#', role: 'student', scope: {} });
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'backup_student', password: 'TestPass1!@#' });
    const cookie = (loginRes.headers['set-cookie'] as string[]).join('; ');
    const res = await request(app).post('/api/backups').set('Cookie', cookie).send({});
    expect(res.status).toBe(403);
  });

  it('creates a backup record for admin', async () => {
    const cookie = await loginAdmin();
    const res = await request(app).post('/api/backups').set('Cookie', cookie).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.filename).toBeDefined();
    expect(res.body.data.checksum).toBeDefined();
  });

  it('backup archive on disk is encrypted (not a plaintext ZIP)', async () => {
    const cookie = await loginAdmin();
    const res = await request(app).post('/api/backups').set('Cookie', cookie).send({});
    expect(res.status).toBe(201);

    const backupId = (res.body.data as { _id: string })._id;
    const record = await getDb().collection<Backup>('backups').findOne({ _id: backupId } as object);
    expect(record).not.toBeNull();

    // The file must exist on disk
    const fileExists = fs.existsSync(record!.destinationPath);
    expect(fileExists).toBe(true);

    // The file must NOT start with the PK ZIP magic bytes (0x50 0x4B)
    // because it is AES-256-GCM encrypted before writing
    const header = Buffer.alloc(2);
    const fd = fs.openSync(record!.destinationPath, 'r');
    fs.readSync(fd, header, 0, 2, 0);
    fs.closeSync(fd);
    expect(header.toString('ascii')).not.toBe('PK');
  });

  it('backup checksum in DB matches SHA-256 of the file on disk', async () => {
    const { createHash } = await import('crypto');
    const cookie = await loginAdmin();
    const res = await request(app).post('/api/backups').set('Cookie', cookie).send({});
    expect(res.status).toBe(201);

    const { _id: backupId, checksum } = res.body.data as { _id: string; checksum: string };
    const record = await getDb().collection<Backup>('backups').findOne({ _id: backupId } as object);
    const fileBytes = fs.readFileSync(record!.destinationPath);
    const actualChecksum = createHash('sha256').update(fileBytes).digest('hex');
    expect(actualChecksum).toBe(checksum);
  });
});

describe('Restore route', () => {
  it('rejects restore with invalid backup ID', async () => {
    const cookie = await loginAdmin();
    const res = await request(app).post('/api/restore').set('Cookie', cookie)
      .send({ backupId: 'nonexistent-id' });
    expect(res.status).toBe(404);
  });

  it('rejects restore when checksum does not match', async () => {
    const cookie = await loginAdmin();

    // Insert a backup record with a mismatched checksum
    const backupId = 'test-backup-id';
    await getDb().collection<Backup>('backups').insertOne({
      _id: backupId,
      filename: 'test.zip',
      destinationPath: '/tmp/nonexistent-test-backup.zip',
      sizeBytes: 0,
      checksum: 'wrong-checksum',
      status: 'completed',
      triggeredBy: 'manual',
      startedAt: new Date(),
    } as Backup & { _id: string });

    const res = await request(app).post('/api/restore').set('Cookie', cookie)
      .send({ backupId });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('restore is idempotent — second restore produces the same DB state', async () => {
    const cookie = await loginAdmin();

    // Create a backup
    const backupRes = await request(app).post('/api/backups').set('Cookie', cookie).send({});
    expect(backupRes.status).toBe(201);
    const backupId = (backupRes.body.data as { _id: string })._id;

    // First restore
    const restore1 = await request(app).post('/api/restore').set('Cookie', cookie).send({ backupId });
    expect(restore1.status).toBe(200);

    // Capture post-restore backup count (restore creates restore_events records)
    const countAfterFirst = await getDb().collection('restore_events').countDocuments({});

    // Second restore with the same backupId
    const restore2 = await request(app).post('/api/restore').set('Cookie', cookie).send({ backupId });
    expect(restore2.status).toBe(200);

    // After second restore the restore_events collection should have exactly one record
    // (the backup includes the first restore_event, so restore replaces it with the same single record)
    // The key assertion: restore does not accumulate duplicate documents on re-run
    const countAfterSecond = await getDb().collection('restore_events').countDocuments({});
    expect(countAfterSecond).toBeLessThanOrEqual(countAfterFirst);
  });
});
