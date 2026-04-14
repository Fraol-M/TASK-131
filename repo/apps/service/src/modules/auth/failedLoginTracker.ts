import { getDb } from '../../persistence/mongoClient.js';
import { config } from '../../config/index.js';
import type { FailedLoginRecord } from '@nexusorder/shared-types';
import { randomUUID } from 'crypto';

const COLLECTION = 'failed_logins';

export async function recordFailedAttempt(username: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const existing = await db.collection<FailedLoginRecord>(COLLECTION).findOne({ username });

  if (!existing) {
    await db.collection<FailedLoginRecord>(COLLECTION).insertOne({
      _id: randomUUID(),
      username,
      attempts: 1,
      lastAttemptAt: now,
    } as FailedLoginRecord & { _id: string });
    return;
  }

  const newAttempts = existing.attempts + 1;
  const updates: Partial<FailedLoginRecord> & { lastAttemptAt: Date } = {
    attempts: newAttempts,
    lastAttemptAt: now,
  };

  if (newAttempts >= config.auth.maxFailedAttempts) {
    const lockoutUntil = new Date(now.getTime() + config.auth.lockoutMinutes * 60 * 1000);
    updates.lockedUntil = lockoutUntil;
  }

  await db.collection<FailedLoginRecord>(COLLECTION).updateOne(
    { username },
    { $set: updates },
  );
}

export async function isLockedOut(username: string): Promise<boolean> {
  const db = getDb();
  const record = await db.collection<FailedLoginRecord>(COLLECTION).findOne({ username });
  if (!record?.lockedUntil) return false;
  return record.lockedUntil > new Date();
}

export async function getLockoutExpiry(username: string): Promise<Date | null> {
  const db = getDb();
  const record = await db.collection<FailedLoginRecord>(COLLECTION).findOne({ username });
  if (!record?.lockedUntil || record.lockedUntil <= new Date()) return null;
  return record.lockedUntil;
}

export async function clearFailedAttempts(username: string): Promise<void> {
  await getDb().collection(COLLECTION).deleteOne({ username });
}
