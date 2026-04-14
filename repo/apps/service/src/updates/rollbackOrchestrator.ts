import { createModuleLogger } from '@nexusorder/shared-logging';
import fs from 'fs';
import path from 'path';
import { getDb } from '../persistence/mongoClient.js';

const log = createModuleLogger('rollbackOrchestrator');

const BUILDS_DIR = process.env['BUILDS_DIR'] ?? path.join(process.cwd(), 'builds');
const CURRENT_LINK = path.join(BUILDS_DIR, 'current');
const PREVIOUS_LINK = path.join(BUILDS_DIR, 'previous');

export const rollbackOrchestrator = {
  /**
   * Swaps the `current` symlink back to `previous` build directory.
   * Records a rollback_event document.
   * Called when startupHealthChecker returns false after an update was applied.
   */
  async rollbackToPrevious(reason: string): Promise<void> {
    log.warn({ reason }, 'Rollback triggered');

    const db = getDb();
    const now = new Date();

    try {
      if (!fs.existsSync(PREVIOUS_LINK)) {
        log.error('No previous build found — cannot rollback');
        await db.collection('rollback_events').insertOne({
          reason, status: 'failed', error: 'No previous build available', timestamp: now,
        });
        return;
      }

      const previousTarget = fs.readlinkSync(PREVIOUS_LINK);

      // Swap: current → previous build
      if (fs.existsSync(CURRENT_LINK)) {
        const currentTarget = fs.readlinkSync(CURRENT_LINK);
        fs.unlinkSync(CURRENT_LINK);
        fs.symlinkSync(previousTarget, CURRENT_LINK);

        // previous now points to what was current (for potential re-rollback)
        fs.unlinkSync(PREVIOUS_LINK);
        fs.symlinkSync(currentTarget, PREVIOUS_LINK);
      }

      await db.collection('rollback_events').insertOne({
        reason, status: 'success', rolledBackTo: previousTarget, timestamp: now,
      });

      log.info({ target: previousTarget }, 'Rollback complete — service restart required');
    } catch (err) {
      log.error({ err }, 'Rollback failed');
      await db.collection('rollback_events').insertOne({
        reason, status: 'failed', error: (err as Error).message, timestamp: now,
      });
    }
  },

  /**
   * Promotes the staged build to `current`, archiving the old `current` as `previous`.
   */
  async promoteUpdate(stagedBuildPath: string): Promise<void> {
    log.info({ stagedBuildPath }, 'Promoting update to current');

    if (fs.existsSync(CURRENT_LINK)) {
      const currentTarget = fs.readlinkSync(CURRENT_LINK);
      if (fs.existsSync(PREVIOUS_LINK)) fs.unlinkSync(PREVIOUS_LINK);
      fs.symlinkSync(currentTarget, PREVIOUS_LINK);
      fs.unlinkSync(CURRENT_LINK);
    }

    fs.symlinkSync(stagedBuildPath, CURRENT_LINK);
    log.info({ stagedBuildPath }, 'Update promoted');
  },
};
