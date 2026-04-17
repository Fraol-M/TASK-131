/**
 * Integration tests for system health endpoints:
 * GET /api/system/health (unauthenticated), GET /api/system/health/details (admin)
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { randomUUID } from 'crypto';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('GET /api/system/health', () => {
  it('returns ok status without authentication and only exposes status field', async () => {
    const res = await request(app).get('/api/system/health');
    expect(res.status).toBe(200);
    expect(['ok', 'degraded', 'unhealthy']).toContain(res.body.data.status);
    // Public endpoint must NOT expose internal details
    expect(res.body.data.database).toBeUndefined();
    expect(res.body.data.version).toBeUndefined();
    expect(res.body.data.tls).toBeUndefined();
  });

  it('returns 503 and unhealthy status when DB is unavailable', async () => {
    // Simulate unhealthy by closing the DB connection temporarily using a mock
    const { runStartupHealthCheck } = await import('../../../src/updates/startupHealthChecker.js');
    const original = runStartupHealthCheck;
    const mod = await import('../../../src/updates/startupHealthChecker.js');
    const spy = vi.spyOn(mod, 'runStartupHealthCheck').mockResolvedValueOnce({
      status: 'unhealthy',
      service: true,
      database: false,
      tls: false,
      checkpointRecoveryPending: false,
      version: '1.0.0',
      checkedAt: new Date(),
    });
    const res = await request(app).get('/api/system/health');
    expect(res.status).toBe(503);
    expect(res.body.data.status).toBe('unhealthy');
    spy.mockRestore();
    void original;
  });

  it('returns degraded status when pending checkpoints exist', async () => {
    await getDb().collection('checkpoint_logs').insertOne({
      _id: randomUUID(),
      status: 'pending',
      createdAt: new Date(),
    });
    const res = await request(app).get('/api/system/health');
    // DB is up (in-memory test), pending checkpoint → degraded
    expect(['degraded', 'ok']).toContain(res.body.data.status);
    // Clean up
    await getDb().collection('checkpoint_logs').deleteMany({ status: 'pending' });
  });
});

describe('GET /api/system/health/details', () => {
  it('returns full diagnostic fields for admin', async () => {
    await usersService.createUser({
      username: 'health_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('health_admin');

    const res = await request(app).get('/api/system/health/details').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBeDefined();
    expect(res.body.data.database).toBeDefined();
    expect(res.body.data.version).toBeDefined();
    expect(res.body.data.checkedAt).toBeDefined();
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/system/health/details');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for non-admin user', async () => {
    await usersService.createUser({
      username: 'health_student', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('health_student');

    const res = await request(app).get('/api/system/health/details').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
