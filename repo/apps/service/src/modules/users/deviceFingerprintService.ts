import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { DeviceConsent, DeviceFingerprint } from '@nexusorder/shared-types';

export const deviceFingerprintService = {
  /**
   * Records (or updates) a user's consent decision for device fingerprinting.
   * A revoked consent is recorded with revokedAt; a new consent resets it.
   */
  async recordConsent(userId: string, consentGiven: boolean): Promise<DeviceConsent> {
    const now = new Date();
    const existing = await getDb()
      .collection<DeviceConsent>('device_consents')
      .findOne({ userId } as unknown as DeviceConsent);

    if (existing) {
      const update = consentGiven
        ? { $set: { consentGiven: true, consentAt: now, revokedAt: undefined } }
        : { $set: { consentGiven: false, revokedAt: now } };
      await getDb().collection<DeviceConsent>('device_consents').updateOne(
        { _id: existing._id } as unknown as DeviceConsent,
        update,
      );
      return { ...existing, consentGiven, consentAt: consentGiven ? now : existing.consentAt, revokedAt: consentGiven ? undefined : now };
    }

    const record: DeviceConsent & { _id: string } = {
      _id: randomUUID(),
      userId,
      consentGiven,
      consentAt: now,
    };
    await getDb().collection<DeviceConsent>('device_consents').insertOne(record);
    return record;
  },

  /**
   * Registers a device fingerprint hash for the user.
   * Returns null without storing if the user has not given consent.
   * The fingerprintHash must be a SHA-256 hex digest computed on the client
   * from hardware + OS attributes — raw source values must never be sent.
   */
  async registerFingerprint(userId: string, fingerprintHash: string): Promise<DeviceFingerprint | null> {
    const consent = await getDb()
      .collection<DeviceConsent>('device_consents')
      .findOne({ userId, consentGiven: true } as unknown as DeviceConsent);

    if (!consent) return null;

    const now = new Date();
    // Upsert: one fingerprint record per user (latest wins)
    const id = randomUUID();
    const existing = await getDb()
      .collection<DeviceFingerprint>('device_fingerprints')
      .findOne({ userId } as unknown as DeviceFingerprint);

    if (existing) {
      await getDb().collection<DeviceFingerprint>('device_fingerprints').updateOne(
        { _id: existing._id } as unknown as DeviceFingerprint,
        { $set: { fingerprintHash, registeredAt: now } },
      );
      return { ...existing, fingerprintHash, registeredAt: now };
    }

    const record: DeviceFingerprint & { _id: string } = {
      _id: id,
      userId,
      fingerprintHash,
      registeredAt: now,
    };
    await getDb().collection<DeviceFingerprint>('device_fingerprints').insertOne(record);
    return record;
  },
};
