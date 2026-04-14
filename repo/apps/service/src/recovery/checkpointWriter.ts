import { randomUUID } from 'crypto';
import { getDb } from '../persistence/mongoClient.js';
import type { CheckpointLog } from '@nexusorder/shared-types';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('checkpointWriter');

/**
 * Write a write-ahead checkpoint before starting a critical multi-step mutation.
 * The checkpoint is marked 'completed' by the caller on success.
 * The recovery scanner finds 'pending' checkpoints on startup and replays/compensates.
 */
export async function writeCheckpoint(params: {
  operationType: string;
  operationId: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const doc: CheckpointLog & { _id: string } = {
    _id: randomUUID(),
    operationType: params.operationType,
    operationId: params.operationId,
    status: 'pending',
    payload: params.payload,
    startedAt: new Date(),
  };

  await getDb().collection<CheckpointLog>('checkpoint_logs').insertOne(doc);
  log.debug({ operationType: params.operationType, operationId: params.operationId }, 'Checkpoint written');
  return doc._id;
}

export async function completeCheckpoint(operationId: string): Promise<void> {
  await getDb().collection<CheckpointLog>('checkpoint_logs').updateOne(
    { operationId },
    { $set: { status: 'completed', completedAt: new Date() } },
  );
}

export async function failCheckpoint(operationId: string, error: string): Promise<void> {
  await getDb().collection<CheckpointLog>('checkpoint_logs').updateOne(
    { operationId },
    { $set: { status: 'failed', recoveryNote: error, completedAt: new Date() } },
  );
}
