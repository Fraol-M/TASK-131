import { randomUUID, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getDb } from '../persistence/mongoClient.js';
import type { UpdatePackage, RollbackEvent } from '@nexusorder/shared-types';
import { emitAuditEvent } from '../audit/auditLog.js';
import { writeCheckpoint, completeCheckpoint, failCheckpoint } from '../recovery/checkpointWriter.js';
import { rollbackOrchestrator } from './rollbackOrchestrator.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('updateImportService');

const BUILDS_DIR = process.env['BUILDS_DIR'] ?? path.join(process.cwd(), 'builds');

export const updateImportService = {
  async importPackage(params: {
    filename: string;
    version: string;
    fileBuffer: Buffer;
    importedBy: string;
  }): Promise<UpdatePackage> {
    const checksum = createHash('sha256').update(params.fileBuffer).digest('hex');
    const id = randomUUID();

    // Write the package archive to disk for later promotion by rollbackOrchestrator
    const stagedDir = path.join(BUILDS_DIR, 'staged');
    fs.mkdirSync(stagedDir, { recursive: true });
    const stagedPath = path.join(stagedDir, `${id}.zip`);
    fs.writeFileSync(stagedPath, params.fileBuffer);

    const pkg: UpdatePackage & { _id: string } = {
      _id: id,
      filename: params.filename,
      version: params.version,
      checksum,
      importedBy: params.importedBy,
      importedAt: new Date(),
      status: 'staged',
      stagedPath,
    };

    await getDb().collection<UpdatePackage>('update_packages').insertOne(pkg);
    await emitAuditEvent({ action: 'update.imported', userId: params.importedBy, meta: { version: params.version, checksum: checksum.slice(0, 8) } });

    return pkg;
  },

  async applyPackage(params: {
    packageId: string;
    appliedBy: string;
  }): Promise<UpdatePackage> {
    const pkg = await getDb().collection<UpdatePackage>('update_packages').findOne(
      { _id: params.packageId } as { _id: string },
    );
    if (!pkg) throw new NotFoundError('Update package');
    if (pkg.status !== 'staged') throw new Error(`Cannot apply package in status '${pkg.status}'`);

    const operationId = randomUUID();
    await writeCheckpoint({ operationType: 'update_apply', operationId, payload: { packageId: params.packageId, appliedBy: params.appliedBy } });

    try {
      // Run all integrity checks and promotion BEFORE marking the package as applied
      // in the DB. This prevents state drift where DB says 'applied' but the symlink
      // was never promoted because a downstream check failed.
      if (pkg.stagedPath && fs.existsSync(pkg.stagedPath)) {
        // 1. Re-verify checksum of the staged file against the value recorded at import time.
        const stagedBuffer = fs.readFileSync(pkg.stagedPath);
        const actualChecksum = createHash('sha256').update(stagedBuffer).digest('hex');
        if (actualChecksum !== pkg.checksum) {
          throw new Error(`Staged package checksum mismatch (stored: ${pkg.checksum.slice(0, 8)}, actual: ${actualChecksum.slice(0, 8)}) — apply aborted`);
        }

        // 2. Extract to a versioned directory.
        const extractDir = pkg.stagedPath.replace(/\.zip$/, '');
        fs.mkdirSync(extractDir, { recursive: true });
        const zip = new AdmZip(pkg.stagedPath);
        zip.extractAllTo(extractDir, /* overwrite */ true);
        log.info({ extractDir }, 'Update package extracted');

        // 3. Integrity gate: verify the extracted build contains the expected entry point
        //    before touching the `current` symlink.
        const expectedEntry = path.join(extractDir, 'dist', 'server.js');
        if (!fs.existsSync(expectedEntry)) {
          throw new Error(`Integrity check failed: expected entry point not found at ${expectedEntry} — apply aborted`);
        }

        // 4. All checks passed — promote to current.
        await rollbackOrchestrator.promoteUpdate(extractDir);
      } else {
        throw new Error(`Staged build path not found for package '${params.packageId}' — apply aborted`);
      }

      // 5. Only mark as applied after promotion succeeds.
      await getDb().collection<UpdatePackage>('update_packages').updateOne(
        { _id: params.packageId } as { _id: string },
        { $set: { status: 'applied', appliedBy: params.appliedBy, appliedAt: new Date() } },
      );

      await completeCheckpoint(operationId);
      await emitAuditEvent({ action: 'update.applied', userId: params.appliedBy, meta: { packageId: params.packageId, version: pkg.version } });
      log.info({ packageId: params.packageId, version: pkg.version }, 'Update package applied');

      return { ...pkg, status: 'applied' };
    } catch (err) {
      await failCheckpoint(operationId, String(err));
      throw err;
    }
  },

  /**
   * Finds the most recently applied package and rolls back the build symlink + DB status.
   * Called automatically by the desktop when the startup health check fails after an update.
   * `triggeredBy` is the actor identity supplied by the caller (e.g. 'internal:desktop:health-check').
   */
  async autoRollback(reason: string, triggeredBy?: string): Promise<RollbackEvent | null> {
    const lastApplied = await getDb().collection<UpdatePackage>('update_packages').findOne(
      { status: 'applied' },
      { sort: { appliedAt: -1 } },
    );
    if (!lastApplied) {
      log.warn('Auto-rollback requested but no applied package found');
      return null;
    }

    await rollbackOrchestrator.rollbackToPrevious(reason);

    return this.rollback({
      updatePackageId: lastApplied._id,
      trigger: 'health_check_failure',
      triggeredBy,
      reason,
    });
  },

  async rollback(params: {
    updatePackageId: string;
    trigger: 'health_check_failure' | 'manual';
    triggeredBy?: string;
    reason: string;
  }): Promise<RollbackEvent> {
    const operationId = randomUUID();
    await writeCheckpoint({ operationType: 'update_apply', operationId, payload: { ...params } });

    const rollback: RollbackEvent & { _id: string } = {
      _id: randomUUID(),
      updatePackageId: params.updatePackageId,
      previousVersion: 'unknown',
      targetVersion: 'previous',
      trigger: params.trigger,
      triggeredBy: params.triggeredBy,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
    };

    await getDb().collection<RollbackEvent>('rollback_events').insertOne(rollback);

    await getDb().collection<UpdatePackage>('update_packages').updateOne(
      { _id: params.updatePackageId } as { _id: string },
      { $set: { status: 'rolled_back', rolledBackAt: new Date(), rollbackReason: params.reason } },
    );

    await completeCheckpoint(operationId);
    await emitAuditEvent({ action: 'update.rolled_back', userId: params.triggeredBy, meta: { reason: params.reason } });

    log.warn({ updatePackageId: params.updatePackageId, trigger: params.trigger }, 'Update rolled back');
    return rollback;
  },
};
