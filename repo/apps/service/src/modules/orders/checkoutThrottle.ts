import { getDb } from '../../persistence/mongoClient.js';
import { config } from '../../config/index.js';
import { BusinessRuleError } from '../../middleware/errorHandler.js';

interface ThrottleRecord {
  _id: string;
  userId: string;
  attempts: { at: Date }[];
}

const COLLECTION = 'checkout_throttles';

/**
 * Enforce per-user checkout throttle: max N attempts per window.
 * Throws BusinessRuleError if the limit has been reached.
 * Sliding window implementation.
 */
export async function assertCheckoutThrottle(userId: string): Promise<void> {
  const windowStart = new Date(
    Date.now() - config.checkout.windowMinutes * 60 * 1000,
  );

  const db = getDb();

  // Remove stale attempts outside the window and fetch current record
  await db.collection<ThrottleRecord>(COLLECTION).updateOne(
    { userId },
    { $pull: { attempts: { at: { $lt: windowStart } } } as Record<string, unknown> },
    { upsert: false },
  );

  const record = await db.collection<ThrottleRecord>(COLLECTION).findOne({ userId });
  const count = record?.attempts.length ?? 0;

  if (count >= config.checkout.maxAttempts) {
    throw new BusinessRuleError(
      'CHECKOUT_THROTTLED',
      `Maximum ${config.checkout.maxAttempts} checkout attempts per ${config.checkout.windowMinutes} minutes reached. Please wait before trying again.`,
    );
  }

  // Record this attempt
  await db.collection<ThrottleRecord>(COLLECTION).updateOne(
    { userId },
    { $push: { attempts: { at: new Date() } } as Record<string, unknown>, $setOnInsert: { _id: userId } },
    { upsert: true },
  );
}
