/**
 * Integration test proving the POST /api/payments/reconciliation/repair handler
 * is reached and successfully repairs an exception.
 * Addresses the audit gap: previous tests only asserted 400/403 guard behavior.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';
import type { PaymentIntent } from '@nexusorder/shared-types';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

describe('POST /api/payments/reconciliation/repair (handler-path)', () => {
  it('admin can repair a paid_unreconciled payment intent', async () => {
    await usersService.createUser({
      username: 'recon_repair_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('recon_repair_admin');

    // Insert a payment intent in paid_unreconciled status directly
    const intentId = randomUUID();
    const paymentIntentId = `pi_${randomUUID()}`;
    await getDb().collection<PaymentIntent>('payment_intents').insertOne({
      _id: intentId,
      paymentIntentId,
      orderId: randomUUID(),
      amount: 100,
      currency: 'CNY',
      status: 'paid_unreconciled',
      duplicateFlag: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PaymentIntent);

    const res = await request(app)
      .post('/api/payments/reconciliation/repair')
      .set('Cookie', cookie)
      .send({ paymentIntentId, note: 'Manually verified against merchant ledger' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Exception repaired');

    // Verify status changed to reconciled
    const updated = await getDb().collection<PaymentIntent>('payment_intents')
      .findOne({ _id: intentId } as { _id: string });
    expect(updated!.status).toBe('reconciled');
    expect(updated!.exceptionRepairNote).toBe('Manually verified against merchant ledger');
  });

  it('admin can repair a paid intent (not just paid_unreconciled)', async () => {
    await usersService.createUser({
      username: 'recon_repair_admin2', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('recon_repair_admin2');

    const intentId = randomUUID();
    const paymentIntentId = `pi_${randomUUID()}`;
    await getDb().collection<PaymentIntent>('payment_intents').insertOne({
      _id: intentId,
      paymentIntentId,
      orderId: randomUUID(),
      amount: 200,
      currency: 'CNY',
      status: 'paid',
      duplicateFlag: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PaymentIntent);

    const res = await request(app)
      .post('/api/payments/reconciliation/repair')
      .set('Cookie', cookie)
      .send({ paymentIntentId, note: 'Direct repair on paid intent' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Exception repaired');
  });

  it('rejects repair on already-reconciled intent', async () => {
    await usersService.createUser({
      username: 'recon_repair_admin3', password: 'TestPass1!@#', role: 'department_admin', scope: {},
    });
    const cookie = await login('recon_repair_admin3');

    const paymentIntentId = `pi_${randomUUID()}`;
    await getDb().collection<PaymentIntent>('payment_intents').insertOne({
      _id: randomUUID(),
      paymentIntentId,
      orderId: randomUUID(),
      amount: 50,
      currency: 'CNY',
      status: 'reconciled',
      duplicateFlag: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PaymentIntent);

    const res = await request(app)
      .post('/api/payments/reconciliation/repair')
      .set('Cookie', cookie)
      .send({ paymentIntentId, note: 'Should fail' });
    expect(res.status).toBe(422);
  });
});
