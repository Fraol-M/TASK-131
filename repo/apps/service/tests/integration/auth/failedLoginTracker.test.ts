import { describe, it, expect, beforeEach } from 'vitest';
import { recordFailedAttempt, isLockedOut, clearFailedAttempts } from '../../../src/modules/auth/failedLoginTracker.js';
import { getDb } from '../../../src/persistence/mongoClient.js';

describe('failedLoginTracker (integration — real DB)', () => {
  const username = 'testuser_tracker_int';

  beforeEach(async () => {
    await getDb().collection('failed_logins').deleteOne({ username });
  });

  it('creates a record on first failed attempt', async () => {
    await recordFailedAttempt(username);
    const record = await getDb().collection('failed_logins').findOne({ username });
    expect(record).not.toBeNull();
    expect(record?.attempts).toBe(1);
  });

  it('increments attempts on subsequent failures', async () => {
    await recordFailedAttempt(username);
    await recordFailedAttempt(username);
    await recordFailedAttempt(username);
    const record = await getDb().collection('failed_logins').findOne({ username });
    expect(record?.attempts).toBe(3);
  });

  it('sets lockedUntil after maxFailedAttempts', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(username);
    }
    const locked = await isLockedOut(username);
    expect(locked).toBe(true);
  });

  it('is not locked before reaching max attempts', async () => {
    for (let i = 0; i < 4; i++) {
      await recordFailedAttempt(username);
    }
    const locked = await isLockedOut(username);
    expect(locked).toBe(false);
  });

  it('clears record on successful login', async () => {
    await recordFailedAttempt(username);
    await clearFailedAttempts(username);
    const record = await getDb().collection('failed_logins').findOne({ username });
    expect(record).toBeNull();
  });

  it('is no longer locked after the lockout window expires (15-minute boundary)', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(username);
    }
    expect(await isLockedOut(username)).toBe(true);

    // Simulate time advancing past the 15-minute lockout by back-dating lockedUntil
    const expired = new Date(Date.now() - 1);
    await getDb().collection('failed_logins').updateOne(
      { username },
      { $set: { lockedUntil: expired } },
    );

    expect(await isLockedOut(username)).toBe(false);
  });
});
