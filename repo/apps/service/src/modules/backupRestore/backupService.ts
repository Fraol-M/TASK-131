import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { Transform } from 'stream';
import archiver from 'archiver';
import { encryptBuffer } from '../../crypto/aes256.js';
import { getDb } from '../../persistence/mongoClient.js';
import type { Backup } from '@nexusorder/shared-types';
import { config } from '../../config/index.js';
import { settingsService } from '../settings/settingsService.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('backupService');

export const backupService = {
  async createBackup(params: {
    triggeredBy: 'scheduled' | 'manual';
    triggeredByUserId?: string;
    destinationPath?: string;
  }): Promise<Backup> {
    const backupId = randomUUID();
    // Priority: explicit override → admin-persisted preference → env/config default
    const destDir = params.destinationPath ?? await settingsService.getBackupDestination();
    const filename = `nexusorder-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip.enc`;
    const fullPath = path.join(destDir, filename);

    fs.mkdirSync(destDir, { recursive: true });

    const startedAt = new Date();
    const backupDoc: Backup & { _id: string } = {
      _id: backupId,
      filename,
      destinationPath: fullPath,
      sizeBytes: 0,
      checksum: '',
      status: 'in_progress',
      triggeredBy: params.triggeredBy,
      triggeredByUserId: params.triggeredByUserId,
      startedAt,
    };

    await getDb().collection<Backup>('backups').insertOne(backupDoc);

    try {
      const db = getDb();
      const collections = await db.listCollections().toArray();
      const archive = archiver('zip', { zlib: { level: 9 } });
      const output = fs.createWriteStream(fullPath);

      // Append each collection as an NDJSON stream
      for (const col of collections) {
        const cursor = db.collection(col.name).find({});
        // Convert MongoDB cursor to a readable NDJSON stream
        const ndjsonTransform = new Transform({
          objectMode: true,
          transform(doc, _encoding, callback) {
            callback(null, JSON.stringify(doc) + '\n');
          },
        });
        archive.append(cursor.stream().pipe(ndjsonTransform), { name: `${col.name}.ndjson` });
      }

      // Write ZIP to a temp buffer via passthrough, then encrypt before writing to disk
      const tmpPath = `${fullPath}.tmp`;
      const tmpOutput = fs.createWriteStream(tmpPath);
      await new Promise<void>((resolve, reject) => {
        archive.pipe(tmpOutput);
        archive.on('error', reject);
        tmpOutput.on('close', resolve);
        void archive.finalize();
      });

      // Encrypt the ZIP and write the final .enc file
      const zipBuffer = fs.readFileSync(tmpPath);
      fs.unlinkSync(tmpPath);
      const encryptedBuffer = encryptBuffer(zipBuffer);
      fs.writeFileSync(fullPath, encryptedBuffer);

      // Compute checksum of the encrypted archive
      const fileBuffer = encryptedBuffer;
      const checksum = createHash('sha256').update(fileBuffer).digest('hex');
      const sizeBytes = fileBuffer.length;

      await getDb().collection<Backup>('backups').updateOne(
        { _id: backupId } as unknown as { _id: string },
        { $set: { status: 'completed', checksum, sizeBytes, completedAt: new Date() } },
      );

      await emitAuditEvent({
        action: 'backup.created',
        userId: params.triggeredByUserId,
        meta: { backupId, filename, sizeBytes, checksumPrefix: checksum.slice(0, 8) },
      });

      log.info({ backupId, filename, sizeBytes }, 'Backup completed');
      return { ...backupDoc, status: 'completed', checksum, sizeBytes };
    } catch (err) {
      await getDb().collection<Backup>('backups').updateOne(
        { _id: backupId } as unknown as { _id: string },
        { $set: { status: 'failed', errorMessage: String(err) } },
      );
      log.error({ err, backupId }, 'Backup failed');
      throw err;
    }
  },

  async listBackups(): Promise<Backup[]> {
    return getDb().collection<Backup>('backups').find({}).sort({ startedAt: -1 }).toArray() as Promise<Backup[]>;
  },

  async getBackup(id: string): Promise<Backup | null> {
    return getDb().collection<Backup>('backups').findOne({ _id: id } as unknown as { _id: string }) as Promise<Backup | null>;
  },
};
