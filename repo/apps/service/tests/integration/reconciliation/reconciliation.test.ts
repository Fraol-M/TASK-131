import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import forge from 'node-forge';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import * as signatureVerifier from '../../../src/crypto/signatureVerifier.js';
import { config } from '../../../src/config/index.js';

const app = createApp();

async function loginAdmin() {
  await usersService.createUser({ username: 'recon_admin', password: 'TestPass1!@#', role: 'department_admin', scope: {} });
  const res = await request(app).post('/api/auth/login').send({ username: 'recon_admin', password: 'TestPass1!@#' });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

const VALID_CSV = `payment_intent_id,amount,currency,transaction_date,signature
pi-001,100.00,USD,2024-01-15,valid_sig_1
pi-002,200.00,USD,2024-01-15,valid_sig_2`;

const MALFORMED_CSV = `wrong_column,amount\npi-001,100.00`;

const DUPLICATE_CSV = `payment_intent_id,amount,currency,transaction_date,signature
pi-001,100.00,USD,2024-01-15,valid_sig_1`;

describe('WeChat Pay Reconciliation', () => {
  it('rejects import with invalid CSV schema (malformed)', async () => {
    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(MALFORMED_CSV), { filename: 'recon.csv', contentType: 'text/csv' });
    expect(res.status).toBe(400);
  });

  it('processes valid CSV (with mock signature verifier)', async () => {
    vi.spyOn(signatureVerifier, 'verifyRowSignature').mockReturnValue(true);
    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(VALID_CSV), { filename: 'recon.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    expect(res.body.data.rowCount).toBe(2);
  });

  it('marks duplicate payment_intent_id on re-import', async () => {
    vi.spyOn(signatureVerifier, 'verifyRowSignature').mockReturnValue(true);
    const cookie = await loginAdmin();

    // First import
    await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(DUPLICATE_CSV), { filename: 'recon1.csv', contentType: 'text/csv' });

    // Second import with same intent ID
    const res = await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(DUPLICATE_CSV), { filename: 'recon2.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.data.duplicateRowCount).toBe(1);
  });

  it('blocks exception repair without note', async () => {
    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/repair')
      .set('Cookie', cookie)
      .send({ paymentIntentId: 'pi-test', note: '' });
    expect(res.status).toBe(400);
  });

  it('blocks exception repair for non-admin', async () => {
    await usersService.createUser({ username: 'stu_recon2', password: 'TestPass1!@#', role: 'student', scope: {} });
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'stu_recon2', password: 'TestPass1!@#' });
    const cookie = (loginRes.headers['set-cookie'] as string[]).join('; ');
    const res = await request(app)
      .post('/api/payments/reconciliation/repair')
      .set('Cookie', cookie)
      .send({ paymentIntentId: 'pi-test', note: 'note here' });
    expect(res.status).toBe(403);
  });

  it('rejects entire import when ANY row has an invalid signature', async () => {
    // verifyRowSignature returns false for the second row — entire import must be rejected
    vi.spyOn(signatureVerifier, 'verifyRowSignature')
      .mockReturnValueOnce(true)  // row 0: valid
      .mockReturnValueOnce(false); // row 1: invalid → abort

    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(VALID_CSV), { filename: 'recon-bad-sig.csv', contentType: 'text/csv' });

    // Must reject the entire import — not create any rows
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('flag-unreconciled rejects empty note with 400', async () => {
    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/flag-unreconciled')
      .set('Cookie', cookie)
      .send({ paymentIntentId: 'pi-any', note: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REQUIRED');
  });

  it('flag-unreconciled rejects missing note with 400', async () => {
    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/flag-unreconciled')
      .set('Cookie', cookie)
      .send({ paymentIntentId: 'pi-any' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REQUIRED');
  });

  it('flag-unreconciled marks a paid intent as paid_unreconciled', async () => {
    vi.spyOn(signatureVerifier, 'verifyRowSignature').mockReturnValue(true);
    const cookie = await loginAdmin();

    // Create a payment intent in paid state via direct DB insert (simulating confirmed payment)
    const { getDb } = await import('../../../src/persistence/mongoClient.js');
    const { randomUUID } = await import('crypto');
    const intentId = randomUUID();
    const paymentIntentId = `pi-unreconciled-${Date.now()}`;
    await getDb().collection('payment_intents').insertOne({
      _id: intentId, paymentIntentId, orderId: 'ord-test', amount: 100,
      currency: 'CNY', status: 'paid', duplicateFlag: false, signatureVerified: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/payments/reconciliation/flag-unreconciled')
      .set('Cookie', cookie)
      .send({ paymentIntentId, note: 'Omitted from merchant batch — flagged for manual review' });
    expect(res.status).toBe(200);

    const updated = await getDb().collection('payment_intents').findOne({ paymentIntentId });
    expect(updated?.['status']).toBe('paid_unreconciled');
    expect(updated?.['unreconciledNote']).toBe('Omitted from merchant batch — flagged for manual review');
    expect(updated?.['unreconciledFlaggedBy']).toBeDefined();
    expect(updated?.['unreconciledFlaggedAt']).toBeInstanceOf(Date);
  });
});

// ─── Real-crypto signature verification (no mocks) ────────────────────────

describe('WeChat Pay Reconciliation — real crypto verification', () => {
  let tmpDir: string;
  let originalKeyPath: string;

  function generateTestKeyPair() {
    const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    return keypair;
  }

  function signPayload(privateKey: forge.pki.rsa.PrivateKey, payload: string): string {
    const md = forge.md.sha256.create();
    md.update(payload, 'utf8');
    const signature = privateKey.sign(md);
    return forge.util.encode64(signature);
  }

  function buildCsvWithRealSignatures(
    privateKey: forge.pki.rsa.PrivateKey,
    rows: Array<{ id: string; amount: string; currency: string; date: string }>,
  ): string {
    const header = 'payment_intent_id,amount,currency,transaction_date,signature';
    const csvRows = rows.map((r) => {
      const payload = `${r.id}|${r.amount}|${r.currency}|${r.date}`;
      const sig = signPayload(privateKey, payload);
      return `${r.id},${r.amount},${r.currency},${r.date},${sig}`;
    });
    return [header, ...csvRows].join('\n');
  }

  // Set up a real RSA key pair and point config at the public key file
  function setupRealKeys() {
    const { privateKey, publicKey } = generateTestKeyPair();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-crypto-'));
    const pubKeyPath = path.join(tmpDir, 'merchant_pub.pem');
    fs.writeFileSync(pubKeyPath, forge.pki.publicKeyToPem(publicKey));

    // Point config at the test key and reset the cached key in verifier
    originalKeyPath = config.reconciliation.merchantPublicKeyPath;
    (config.reconciliation as { merchantPublicKeyPath: string }).merchantPublicKeyPath = pubKeyPath;
    signatureVerifier._resetPublicKeyCache();

    return { privateKey, publicKey };
  }

  afterEach(() => {
    // Restore original config and clean up
    if (originalKeyPath !== undefined) {
      (config.reconciliation as { merchantPublicKeyPath: string }).merchantPublicKeyPath = originalKeyPath;
      signatureVerifier._resetPublicKeyCache();
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('accepts CSV with valid real RSA signatures (no mocks)', async () => {
    const { privateKey } = setupRealKeys();
    const csv = buildCsvWithRealSignatures(privateKey, [
      { id: 'pi-real-001', amount: '100.00', currency: 'USD', date: '2024-01-15' },
      { id: 'pi-real-002', amount: '250.50', currency: 'USD', date: '2024-01-15' },
    ]);

    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csv), { filename: 'recon-real.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.data.rowCount).toBe(2);
  });

  it('rejects CSV when signature is tampered (no mocks)', async () => {
    const { privateKey } = setupRealKeys();
    // Sign with the correct key but tamper the signature afterward
    const rows = [
      { id: 'pi-tamper-001', amount: '100.00', currency: 'USD', date: '2024-01-15' },
    ];
    let csv = buildCsvWithRealSignatures(privateKey, rows);
    // Corrupt the base64 signature on the first data row
    const lines = csv.split('\n');
    lines[1] = lines[1]!.replace(/[A-Za-z]/, (c) =>
      c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase(),
    );
    csv = lines.join('\n');

    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csv), { filename: 'recon-tampered.csv', contentType: 'text/csv' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('rejects CSV signed with wrong key (no mocks)', async () => {
    setupRealKeys(); // sets up the "merchant" key
    // Generate a DIFFERENT key pair and sign with the wrong private key
    const wrongKeypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const csv = buildCsvWithRealSignatures(wrongKeypair.privateKey, [
      { id: 'pi-wrongkey-001', amount: '50.00', currency: 'CNY', date: '2024-02-01' },
    ]);

    const cookie = await loginAdmin();
    const res = await request(app)
      .post('/api/payments/reconciliation/import')
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csv), { filename: 'recon-wrongkey.csv', contentType: 'text/csv' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });
});
