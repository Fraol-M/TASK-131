import { randomUUID } from 'crypto';
import type { AuditAction, AuditEvent } from '@nexusorder/shared-types';
import { getDb } from '../persistence/mongoClient.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('auditLog');
const COLLECTION = 'order_audit_events';

export async function emitAuditEvent(params: {
  action: AuditAction;
  userId?: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const event: AuditEvent = {
    _id: randomUUID(),
    action: params.action,
    userId: params.userId,
    targetType: params.targetType,
    targetId: params.targetId,
    correlationId: params.correlationId,
    meta: params.meta,
    occurredAt: new Date(),
  };

  try {
    await getDb().collection<AuditEvent>(COLLECTION).insertOne(event as AuditEvent & { _id: string });
  } catch (err) {
    // Audit log failures must never block business operations — log and continue
    log.error({ err, action: params.action }, 'Failed to persist audit event');
  }
}
