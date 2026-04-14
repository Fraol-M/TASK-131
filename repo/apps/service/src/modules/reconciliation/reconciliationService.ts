import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { ReconciliationImport, ReconciliationRow, PaymentIntent } from '@nexusorder/shared-types';
import { parseCsvBuffer, buildRowSignaturePayload } from './csvParser.js';
import { verifyRowSignature } from '../../crypto/signatureVerifier.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { BusinessRuleError, ForbiddenError } from '../../middleware/errorHandler.js';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { orderRepository } from '../orders/orderRepository.js';
import { guardTransition } from '../orders/orderStateMachine.js';

const log = createModuleLogger('reconciliationService');

export const reconciliationService = {
  async importCsv(params: {
    fileBuffer: Buffer;
    filename: string;
    importedBy: string;
  }): Promise<ReconciliationImport> {
    const { fileBuffer, filename, importedBy } = params;
    const importId = randomUUID();
    const now = new Date();

    // Parse and validate CSV schema
    const rows = await parseCsvBuffer(fileBuffer);

    // Create import record
    const importRecord: ReconciliationImport & { _id: string } = {
      _id: importId,
      filename,
      importedBy,
      importedAt: now,
      rowCount: rows.length,
      validRowCount: 0,
      duplicateRowCount: 0,
      errorRowCount: 0,
      signatureValid: true,
      status: 'processing',
    };

    await getDb().collection<ReconciliationImport>('payment_reconciliation_imports').insertOne(importRecord);

    // Pre-flight signature validation: verify ALL rows before persisting anything.
    // A single invalid signature rejects the entire import — partial acceptance would
    // allow tampered rows to slip through as "exception" rows.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const signaturePayload = buildRowSignaturePayload(row);
      let signatureValid = false;
      try {
        signatureValid = verifyRowSignature(signaturePayload, row.signature);
      } catch (err) {
        log.warn({ err, rowIndex: i }, 'Signature verification error');
      }
      if (!signatureValid) {
        // Abort the entire import — mark the import record as failed and throw
        await getDb().collection<ReconciliationImport>('payment_reconciliation_imports').updateOne(
          { _id: importId } as { _id: string },
          { $set: { status: 'failed', signatureValid: false } },
        );
        await emitAuditEvent({
          action: 'payment.reconciliation_import_rejected',
          userId: importedBy,
          targetType: 'reconciliation_import',
          targetId: importId,
          meta: { filename, reason: 'invalid_signature', rowIndex: i },
        });
        throw new BusinessRuleError(
          'INVALID_SIGNATURE',
          `Row ${i} has an invalid merchant signature — import rejected`,
        );
      }
    }

    let validCount = 0;
    let duplicateCount = 0;
    const matchedPaymentIntentIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      // Idempotency: check for duplicate payment_intent_id in this import or any previous import
      const isDuplicate = !!(await getDb()
        .collection<ReconciliationRow>('payment_reconciliation_rows')
        .findOne({ paymentIntentId: row.payment_intent_id }));

      if (isDuplicate) duplicateCount++;
      else validCount++;

      const rowDoc: ReconciliationRow & { _id: string } = {
        _id: randomUUID(),
        importId,
        rowIndex: i,
        paymentIntentId: row.payment_intent_id,
        amount: parseFloat(row.amount),
        currency: row.currency,
        transactionDate: new Date(row.transaction_date),
        importedAt: now,
        rawSignature: row.signature,
        signatureValid: true, // all rows passed pre-flight above
        isDuplicate,
        status: isDuplicate ? 'duplicate' : 'unmatched',
      };

      // Match to existing payment intent for valid, non-duplicate rows
      if (!isDuplicate) {
        const intent = await getDb()
          .collection<PaymentIntent>('payment_intents')
          .findOne({ paymentIntentId: row.payment_intent_id });

        if (intent) {
          rowDoc.matchedPaymentIntentDocId = intent._id;
          rowDoc.status = 'matched';
          matchedPaymentIntentIds.add(intent._id);
          await getDb().collection<PaymentIntent>('payment_intents').updateOne(
            { _id: intent._id } as { _id: string },
            { $set: { status: 'reconciled', reconciliationImportId: importId, signatureVerified: true, updatedAt: new Date() } },
          );

          // Advance the corresponding order to 'paid' if it is still in 'approved' state.
          // If manual payment confirmation already advanced it, the state will be 'paid' or
          // later — skip the transition to avoid a state-machine violation.
          try {
            const order = await orderRepository.findById(intent.orderId);
            if (order.state === 'approved') {
              guardTransition(order.state, 'paid');
              await orderRepository.updateState(order._id, order.version, {
                state: 'paid',
                paidAt: new Date(),
                autoCancelAt: undefined,
              });
              await emitAuditEvent({
                action: 'order.paid',
                targetType: 'order',
                targetId: order._id,
                meta: { source: 'reconciliation', importId },
              });
            }
          } catch (orderErr) {
            log.warn({ err: orderErr, orderId: intent.orderId }, 'Reconciliation matched intent but could not advance order state');
          }
        }
      } else {
        rowDoc.processingError = 'Duplicate payment_intent_id';
        await getDb().collection<PaymentIntent>('payment_intents').updateOne(
          { paymentIntentId: row.payment_intent_id },
          { $set: { duplicateFlag: true, updatedAt: new Date() } },
        );
      }

      try {
        await getDb().collection<ReconciliationRow>('payment_reconciliation_rows').insertOne(rowDoc);
      } catch (insertErr: unknown) {
        // Handle unique-key conflict (concurrent import race) — treat as duplicate
        if ((insertErr as { code?: number }).code === 11000) {
          if (!isDuplicate) {
            duplicateCount++;
            validCount--;
          }
          log.warn({ paymentIntentId: row.payment_intent_id }, 'Concurrent duplicate detected via unique index');
        } else {
          throw insertErr;
        }
      }
    }

    // Finalize import record
    await getDb().collection<ReconciliationImport>('payment_reconciliation_imports').updateOne(
      { _id: importId } as { _id: string },
      {
        $set: {
          validRowCount: validCount,
          duplicateRowCount: duplicateCount,
          errorRowCount: 0,
          signatureValid: true,
          status: 'completed',
        },
      },
    );

    await emitAuditEvent({
      action: 'payment.reconciliation_imported',
      userId: importedBy,
      targetType: 'reconciliation_import',
      targetId: importId,
      meta: { filename, rowCount: rows.length, validCount, duplicateCount },
    });

    return { ...importRecord, validRowCount: validCount, duplicateRowCount: duplicateCount, errorRowCount: 0, signatureValid: true, status: 'completed' };
  },

  /**
   * Marks a `paid` payment intent as `paid_unreconciled` to flag it for manual
   * reconciliation review. Called by an admin when a known payment cannot be
   * matched in the merchant's CSV batch (e.g. the batch period has closed and
   * the intent was never included in any import).
   */
  async flagUnreconciled(params: {
    paymentIntentId: string;
    adminId: string;
    note: string;
  }): Promise<void> {
    const intent = await getDb()
      .collection<PaymentIntent>('payment_intents')
      .findOne({ paymentIntentId: params.paymentIntentId });

    if (!intent) throw new BusinessRuleError('NOT_FOUND', 'Payment intent not found');

    if (intent.status !== 'paid') {
      throw new BusinessRuleError(
        'INVALID_STATUS',
        `Can only flag 'paid' intents as unreconciled; current status is '${intent.status}'`,
      );
    }

    await getDb().collection<PaymentIntent>('payment_intents').updateOne(
      { _id: intent._id } as { _id: string },
      {
        $set: {
          status: 'paid_unreconciled',
          unreconciledNote: params.note,
          unreconciledFlaggedBy: params.adminId,
          unreconciledFlaggedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    await emitAuditEvent({
      action: 'payment.flagged_unreconciled',
      userId: params.adminId,
      targetType: 'payment_intent',
      targetId: params.paymentIntentId,
      meta: { note: params.note },
    });
  },

  async repairException(params: {
    paymentIntentId: string;
    note: string;
    adminId: string;
  }): Promise<void> {
    const { paymentIntentId, note, adminId } = params;

    if (!note || note.trim().length === 0) {
      throw new BusinessRuleError('NOTE_REQUIRED', 'Admin note is required for exception repair');
    }

    const intent = await getDb()
      .collection<PaymentIntent>('payment_intents')
      .findOne({ paymentIntentId });

    if (!intent) throw new BusinessRuleError('NOT_FOUND', 'Payment intent not found');

    if (intent.status !== 'paid_unreconciled' && intent.status !== 'paid') {
      throw new BusinessRuleError('INVALID_STATUS', `Cannot repair exception for intent in status '${intent.status}'`);
    }

    await getDb().collection<PaymentIntent>('payment_intents').updateOne(
      { _id: intent._id } as { _id: string },
      {
        $set: {
          status: 'reconciled',
          exceptionRepairNote: note,
          exceptionRepairedBy: adminId,
          exceptionRepairedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    await emitAuditEvent({
      action: 'payment.exception_repaired',
      userId: adminId,
      targetType: 'payment_intent',
      targetId: paymentIntentId,
      meta: { note },
    });
  },

  async listRows(): Promise<ReconciliationRow[]> {
    return getDb()
      .collection<ReconciliationRow>('payment_reconciliation_rows')
      .find({})
      .sort({ importedAt: -1, rowIndex: 1 })
      .limit(500)
      .toArray() as Promise<ReconciliationRow[]>;
  },
};
