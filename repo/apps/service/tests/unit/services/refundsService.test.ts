/**
 * Unit tests for refundsService validation logic.
 * Tests the linkage, status eligibility, and amount limit checks.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { refundsService } from '../../../src/modules/payments/refundsService.js';
import type { PaymentIntent } from '@nexusorder/shared-types';

async function insertIntent(overrides: Partial<PaymentIntent> = {}): Promise<PaymentIntent & { _id: string }> {
  const intent: PaymentIntent & { _id: string } = {
    _id: randomUUID(),
    paymentIntentId: randomUUID(),
    orderId: randomUUID(),
    amount: 200,
    currency: 'CNY',
    status: 'paid',
    duplicateFlag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PaymentIntent & { _id: string };
  await getDb().collection<PaymentIntent>('payment_intents').insertOne(intent);
  return intent;
}

describe('refundsService.createRefund', () => {
  it('creates a refund when all validations pass', async () => {
    const intent = await insertIntent({ status: 'paid', amount: 300 });
    const refund = await refundsService.createRefund({
      orderId: intent.orderId,
      paymentIntentId: intent._id,
      amount: 100,
      currency: 'CNY',
      reason: 'Customer request',
      reasonCode: 'customer_request',
    }, 'admin-user');

    expect(refund.orderId).toBe(intent.orderId);
    expect(refund.amount).toBe(100);
    expect(refund.status).toBe('pending');
  });

  it('rejects when paymentIntentId does not exist', async () => {
    await expect(refundsService.createRefund({
      orderId: 'some-order',
      paymentIntentId: 'nonexistent-intent',
      amount: 50,
      currency: 'CNY',
      reason: 'test',
      reasonCode: 'test',
    }, 'admin')).rejects.toThrow('not found');
  });

  it('rejects when orderId does not match the intent orderId', async () => {
    const intent = await insertIntent({ status: 'paid' });
    await expect(refundsService.createRefund({
      orderId: 'wrong-order-id',
      paymentIntentId: intent._id,
      amount: 50,
      currency: 'CNY',
      reason: 'test',
      reasonCode: 'test',
    }, 'admin')).rejects.toThrow('does not belong');
  });

  it('rejects when payment status is pending (not refundable)', async () => {
    const intent = await insertIntent({ status: 'pending' });
    await expect(refundsService.createRefund({
      orderId: intent.orderId,
      paymentIntentId: intent._id,
      amount: 50,
      currency: 'CNY',
      reason: 'test',
      reasonCode: 'test',
    }, 'admin')).rejects.toThrow('not eligible for refund');
  });

  it('rejects when refund amount exceeds paid amount', async () => {
    const intent = await insertIntent({ status: 'paid', amount: 100 });
    await expect(refundsService.createRefund({
      orderId: intent.orderId,
      paymentIntentId: intent._id,
      amount: 150,
      currency: 'CNY',
      reason: 'over-refund',
      reasonCode: 'test',
    }, 'admin')).rejects.toThrow('exceed');
  });

  it('allows refund on reconciled status', async () => {
    const intent = await insertIntent({ status: 'reconciled', amount: 200 });
    const refund = await refundsService.createRefund({
      orderId: intent.orderId,
      paymentIntentId: intent._id,
      amount: 100,
      currency: 'CNY',
      reason: 'partial refund',
      reasonCode: 'customer_request',
    }, 'admin');
    expect(refund.status).toBe('pending');
  });

  it('tracks cumulative refunds against the limit', async () => {
    const intent = await insertIntent({ status: 'paid', amount: 200 });
    // First refund: 150 — should succeed
    await refundsService.createRefund({
      orderId: intent.orderId,
      paymentIntentId: intent._id,
      amount: 150,
      currency: 'CNY',
      reason: 'first',
      reasonCode: 'test',
    }, 'admin');

    // Second refund: 100 — should fail (150 + 100 > 200)
    await expect(refundsService.createRefund({
      orderId: intent.orderId,
      paymentIntentId: intent._id,
      amount: 100,
      currency: 'CNY',
      reason: 'second over limit',
      reasonCode: 'test',
    }, 'admin')).rejects.toThrow('exceed');
  });
});

describe('refundsService.getByOrder', () => {
  it('returns refunds for the specified order', async () => {
    const intent = await insertIntent({ status: 'paid', amount: 500 });
    await refundsService.createRefund({
      orderId: intent.orderId,
      paymentIntentId: intent._id,
      amount: 100,
      currency: 'CNY',
      reason: 'test',
      reasonCode: 'test',
    }, 'admin');

    const refunds = await refundsService.getByOrder(intent.orderId);
    expect(refunds.length).toBe(1);
    expect(refunds[0].orderId).toBe(intent.orderId);
  });

  it('returns empty array for order with no refunds', async () => {
    const refunds = await refundsService.getByOrder('nonexistent-order');
    expect(refunds).toEqual([]);
  });
});
