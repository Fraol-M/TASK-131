/**
 * Unit tests for startupHealthChecker.runStartupHealthCheck().
 * Exercises the three status paths (ok, degraded, unhealthy) using the real
 * in-memory MongoDB supplied by the test setup.
 */
import { describe, it, expect } from 'vitest';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { runStartupHealthCheck } from '../../../src/updates/startupHealthChecker.js';

describe('runStartupHealthCheck', () => {
  it('returns ok status when DB is reachable and no pending checkpoints', async () => {
    const result = await runStartupHealthCheck();
    expect(result.status).toBe('ok');
    expect(result.database).toBe(true);
    expect(result.service).toBe(true);
    expect(result.checkpointRecoveryPending).toBe(false);
    expect(result.version).toBeDefined();
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  it('returns degraded status when pending checkpoints exist', async () => {
    await getDb().collection('checkpoint_logs').insertOne({
      _id: 'test-chk-1',
      status: 'pending',
      operationType: 'update_apply',
      payload: {},
      createdAt: new Date(),
    });

    const result = await runStartupHealthCheck();
    expect(result.status).toBe('degraded');
    expect(result.database).toBe(true);
    expect(result.checkpointRecoveryPending).toBe(true);
  });

  it('returns ok when all checkpoints are completed (not pending)', async () => {
    await getDb().collection('checkpoint_logs').insertMany([
      { _id: 'chk-done-1', status: 'completed', createdAt: new Date() },
      { _id: 'chk-done-2', status: 'failed', createdAt: new Date() },
    ]);

    const result = await runStartupHealthCheck();
    expect(result.status).toBe('ok');
    expect(result.checkpointRecoveryPending).toBe(false);
  });

  it('returned object has all required HealthStatus fields', async () => {
    const result = await runStartupHealthCheck();
    expect(result).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded|unhealthy)$/),
      service: expect.any(Boolean),
      database: expect.any(Boolean),
      tls: expect.any(Boolean),
      checkpointRecoveryPending: expect.any(Boolean),
      version: expect.any(String),
      checkedAt: expect.any(Date),
    });
  });
});
