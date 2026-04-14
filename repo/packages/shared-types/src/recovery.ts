export type CheckpointStatus = 'pending' | 'completed' | 'failed' | 'recovered';

export interface CheckpointLog {
  _id: string;
  operationType: string; // e.g. 'order_split', 'order_merge', 'restore', 'update_apply'
  operationId: string; // correlation ID for the operation
  status: CheckpointStatus;
  payload: Record<string, unknown>; // serialized state for recovery
  startedAt: Date;
  completedAt?: Date;
  recoveredAt?: Date;
  recoveryNote?: string;
}
