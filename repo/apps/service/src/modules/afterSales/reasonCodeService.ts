import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { ReasonCode } from '@nexusorder/shared-types';
import { BusinessRuleError, NotFoundError } from '../../middleware/errorHandler.js';
import { emitAuditEvent } from '../../audit/auditLog.js';

export const reasonCodeService = {
  async list(): Promise<ReasonCode[]> {
    return getDb()
      .collection<ReasonCode>('reason_codes')
      .find({})
      .sort({ code: 1 })
      .toArray();
  },

  async create(params: {
    code: string;
    label: string;
    applicableTo: ('return' | 'refund' | 'exchange')[];
    adminId: string;
  }): Promise<ReasonCode> {
    const existing = await getDb()
      .collection<ReasonCode>('reason_codes')
      .findOne({ code: params.code });

    if (existing) {
      throw new BusinessRuleError('DUPLICATE_CODE', `Reason code '${params.code}' already exists`);
    }

    const now = new Date();
    const doc: ReasonCode = {
      _id: randomUUID(),
      code: params.code,
      label: params.label,
      applicableTo: params.applicableTo,
      isActive: true,
      createdBy: params.adminId,
      createdAt: now,
      updatedAt: now,
    };

    await getDb().collection<ReasonCode>('reason_codes').insertOne(doc);

    await emitAuditEvent({
      action: 'reason_code.created',
      userId: params.adminId,
      targetType: 'reason_code',
      targetId: doc._id,
      meta: { code: params.code, label: params.label },
    });

    return doc;
  },

  async update(params: {
    id: string;
    label?: string;
    applicableTo?: ('return' | 'refund' | 'exchange')[];
    isActive?: boolean;
    adminId: string;
  }): Promise<ReasonCode> {
    const existing = await getDb()
      .collection<ReasonCode>('reason_codes')
      .findOne({ _id: params.id } as { _id: string });

    if (!existing) throw new NotFoundError('ReasonCode');

    const updates: Partial<ReasonCode> = { updatedAt: new Date() };
    if (params.label !== undefined) updates.label = params.label;
    if (params.applicableTo !== undefined) updates.applicableTo = params.applicableTo;
    if (params.isActive !== undefined) updates.isActive = params.isActive;

    await getDb()
      .collection<ReasonCode>('reason_codes')
      .updateOne({ _id: params.id } as { _id: string }, { $set: updates });

    await emitAuditEvent({
      action: 'reason_code.updated',
      userId: params.adminId,
      targetType: 'reason_code',
      targetId: params.id,
      meta: updates,
    });

    return { ...existing, ...updates };
  },

  /**
   * Validates that a reason code exists and is active.
   * Called by afterSalesService before creating an RMA.
   */
  async assertValidReasonCode(code: string): Promise<void> {
    const rc = await getDb()
      .collection<ReasonCode>('reason_codes')
      .findOne({ code });

    if (!rc) {
      throw new BusinessRuleError('INVALID_REASON_CODE', `Reason code '${code}' does not exist`);
    }
    if (!rc.isActive) {
      throw new BusinessRuleError('REASON_CODE_INACTIVE', `Reason code '${code}' is no longer active`);
    }
  },
};
