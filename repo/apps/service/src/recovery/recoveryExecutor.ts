import { getDb } from '../persistence/mongoClient.js';
import { createModuleLogger } from '@nexusorder/shared-logging';
import type { CheckpointLog } from '@nexusorder/shared-types';

const log = createModuleLogger('recoveryExecutor');

/**
 * Executes compensating actions for incomplete checkpoints found at startup.
 *
 * Strategy by operation type:
 * - order_split / order_merge → mark as `recovered` (requires admin review via UI/audit)
 * - restore → mark as `failed` (partial restore is unsafe to resume automatically)
 * - update_apply → mark as `failed` (rollback path handles this via rollbackOrchestrator)
 *
 * All executions emit audit log entries for traceability.
 */
export const recoveryExecutor = {
  async execute(checkpoint: CheckpointLog): Promise<void> {
    const db = getDb();
    const now = new Date();

    switch (checkpoint.operationType) {
      case 'order_split':
      case 'order_merge': {
        // Mark as recovered — admin must verify via audit log
        await db.collection<CheckpointLog>('checkpoint_logs').updateOne(
          { _id: checkpoint._id as unknown },
          { $set: { status: 'recovered', resolvedAt: now, resolution: 'auto_flagged_for_admin_review' } },
        );
        await db.collection('order_audit_events').insertOne({
          action: `${checkpoint.operationType}_recovery`,
          entityType: 'order',
          entityId: checkpoint.entityId,
          checkpointId: checkpoint._id,
          note: 'Incomplete operation found at startup — admin review required',
          timestamp: now,
        });
        log.warn({ checkpointId: checkpoint._id, op: checkpoint.operationType }, 'Incomplete mutation flagged for admin review');
        break;
      }

      case 'restore':
      case 'update_apply': {
        // These are unsafe to resume — mark failed, rollbackOrchestrator handles the rollback path
        await db.collection<CheckpointLog>('checkpoint_logs').updateOne(
          { _id: checkpoint._id as unknown },
          { $set: { status: 'failed', resolvedAt: now, resolution: 'auto_failed_unsafe_to_resume' } },
        );
        log.error({ checkpointId: checkpoint._id, op: checkpoint.operationType }, 'Unsafe incomplete operation marked failed — rollback path should trigger');
        break;
      }

      default:
        log.warn({ checkpoint }, 'Unknown checkpoint operation type — skipping');
    }
  },
};
