import fs from 'fs';
import { createHash, randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
import { decryptBuffer } from '../../crypto/aes256.js';
import { getDb } from '../../persistence/mongoClient.js';
import type { Backup, RestoreEvent } from '@nexusorder/shared-types';
import { writeCheckpoint, completeCheckpoint, failCheckpoint } from '../../recovery/checkpointWriter.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { BusinessRuleError, NotFoundError } from '../../middleware/errorHandler.js';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { runIndexes } from '../../persistence/runIndexes.js';

const log = createModuleLogger('restoreService');

export const restoreService = {
  async restore(params: { backupId: string; restoredBy: string }): Promise<RestoreEvent> {
    const existingCompleted = await getDb().collection<RestoreEvent>('restore_events').findOne(
      { backupId: params.backupId, status: 'completed' } as { backupId: string; status: 'completed' },
      { sort: { completedAt: -1 } },
    );
    if (existingCompleted) {
      return existingCompleted;
    }

    const backup = await getDb().collection<Backup>('backups').findOne({ _id: params.backupId } as { _id: string });
    if (!backup) throw new NotFoundError('Backup');
    if (backup.status !== 'completed' && backup.status !== 'in_progress') {
      throw new BusinessRuleError('BACKUP_INCOMPLETE', 'Cannot restore from an incomplete backup');
    }

    const restoreId = randomUUID();
    const operationId = randomUUID();

    const restoreDoc: RestoreEvent & { _id: string } = {
      _id: restoreId,
      backupId: params.backupId,
      restoredBy: params.restoredBy,
      status: 'validating',
      checksumVerified: false,
      startedAt: new Date(),
    };

    await getDb().collection<RestoreEvent>('restore_events').insertOne(restoreDoc);

    await writeCheckpoint({
      operationType: 'restore',
      operationId,
      payload: { backupId: params.backupId, restoreId, restoredBy: params.restoredBy },
    });

    try {
      // 1. Verify checksum
      if (!fs.existsSync(backup.destinationPath)) {
        throw new BusinessRuleError('BACKUP_FILE_MISSING', `Backup file not found at ${backup.destinationPath}`);
      }

      const fileBuffer = fs.readFileSync(backup.destinationPath);
      const actualChecksum = createHash('sha256').update(fileBuffer).digest('hex');

      if (backup.checksum && actualChecksum !== backup.checksum) {
        throw new BusinessRuleError(
          'CHECKSUM_MISMATCH',
          `Backup checksum verification failed. Expected: ${backup.checksum.slice(0, 8)}... Got: ${actualChecksum.slice(0, 8)}...`,
        );
      }

      await getDb().collection<RestoreEvent>('restore_events').updateOne(
        { _id: restoreId } as { _id: string },
        { $set: { checksumVerified: true, status: 'restoring' } },
      );

      // 2. Decrypt the backup archive, then unpack and rehydrate collections
      log.info({ backupId: params.backupId, restoreId }, 'Decrypting and extracting backup archive…');
      const zipBuffer = decryptBuffer(fileBuffer);
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      const db = getDb();
      let collectionCount = 0;

      for (const entry of entries) {
        if (!entry.entryName.endsWith('.ndjson')) continue;

        const collectionName = entry.entryName.replace(/\.ndjson$/, '');
        if (collectionName === 'backups' || collectionName === 'restore_events' || collectionName === 'checkpoint_logs') {
          continue;
        }
        const content = entry.getData().toString('utf8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);

        if (lines.length === 0) continue;

        const documents = lines.map((line) => JSON.parse(line) as Record<string, unknown>);

        // Clear existing collection data and re-insert from backup
        await db.collection(collectionName).deleteMany({});
        await db.collection(collectionName).insertMany(documents);
        collectionCount++;
        log.info({ collectionName, docCount: documents.length }, 'Collection restored');
      }

      log.info({ backupId: params.backupId, restoreId, collectionCount }, 'All collections restored');

      // Re-run indexes to ensure all index definitions are present after restore
      await runIndexes();

      await getDb().collection<RestoreEvent>('restore_events').updateOne(
        { _id: restoreId } as { _id: string },
        { $set: { status: 'completed', completedAt: new Date() } },
      );

      await completeCheckpoint(operationId);

      await emitAuditEvent({
        action: 'restore.performed',
        userId: params.restoredBy,
        meta: { backupId: params.backupId, restoreId },
      });

      return { ...restoreDoc, status: 'completed', checksumVerified: true };
    } catch (err) {
      await getDb().collection<RestoreEvent>('restore_events').updateOne(
        { _id: restoreId } as { _id: string },
        { $set: { status: 'failed', errorMessage: String(err) } },
      );
      await failCheckpoint(operationId, String(err));
      throw err;
    }
  },
};
