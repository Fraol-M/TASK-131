/**
 * Integration tests for rules CRUD, activation, conflict detection, and simulation HTTP endpoints.
 * Covers: GET /api/rules, POST /api/rules, GET /api/rules/:id, PATCH /api/rules/:id,
 *         POST /api/rules/:id/activate, POST /api/rules/:id/deactivate,
 *         GET /api/rules/conflicts/all, POST /api/rules/simulations
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';
import type { Order } from '@nexusorder/shared-types';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupAdmin(suffix: string) {
  await usersService.createUser({
    username: `rule_admin_${suffix}`, password: 'TestPass1!@#', role: 'department_admin', scope: {},
  });
  return login(`rule_admin_${suffix}`);
}

const sampleRule = {
  name: 'High-Value Order Flag',
  scope: {},
  priority: 10,
  conditions: { logic: 'and', conditions: [{ field: 'total', operator: 'gte', value: 500 }] },
  actions: [{ type: 'flag', parameters: { reason: 'high_value' } }],
};

// ─── GET /api/rules ─────────────────────────────────────────────────────────

describe('GET /api/rules', () => {
  it('admin can list rules', async () => {
    const cookie = await setupAdmin('list1');
    const res = await request(app).get('/api/rules').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'rule_student_list', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('rule_student_list');
    const res = await request(app).get('/api/rules').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/rules ────────────────────────────────────────────────────────

describe('POST /api/rules', () => {
  it('admin can create a rule', async () => {
    const cookie = await setupAdmin('create1');
    const res = await request(app).post('/api/rules').set('Cookie', cookie).send(sampleRule);
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('High-Value Order Flag');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.version).toBe(1);
    expect(res.body.data._id).toBeDefined();
  });

  it('rejects invalid payload (missing conditions)', async () => {
    const cookie = await setupAdmin('create2');
    const res = await request(app).post('/api/rules').set('Cookie', cookie)
      .send({ name: 'Bad Rule', scope: {}, priority: 1, actions: [{ type: 'x', parameters: {} }] });
    expect(res.status).toBe(400);
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'rule_student_create', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('rule_student_create');
    const res = await request(app).post('/api/rules').set('Cookie', cookie).send(sampleRule);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/rules/:id ─────────────────────────────────────────────────────

describe('GET /api/rules/:id', () => {
  it('admin can get a rule by ID', async () => {
    const cookie = await setupAdmin('getid1');
    const createRes = await request(app).post('/api/rules').set('Cookie', cookie).send(sampleRule);
    const ruleId = createRes.body.data._id;

    const res = await request(app).get(`/api/rules/${ruleId}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(ruleId);
    expect(res.body.data.name).toBe('High-Value Order Flag');
  });

  it('returns 404 for non-existent rule', async () => {
    const cookie = await setupAdmin('getid2');
    const res = await request(app).get(`/api/rules/${randomUUID()}`).set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/rules/:id ───────────────────────────────────────────────────

describe('PATCH /api/rules/:id', () => {
  it('admin can update a rule', async () => {
    const cookie = await setupAdmin('patch1');
    const createRes = await request(app).post('/api/rules').set('Cookie', cookie).send(sampleRule);
    const ruleId = createRes.body.data._id;

    const res = await request(app).patch(`/api/rules/${ruleId}`).set('Cookie', cookie)
      .send({ name: 'Updated Rule Name', priority: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Rule Name');
    expect(res.body.data.priority).toBe(5);
    expect(res.body.data.version).toBe(2);
  });
});

// ─── POST /api/rules/:id/activate ───────────────────────────────────────────

describe('POST /api/rules/:id/activate', () => {
  it('admin can activate a draft rule', async () => {
    const cookie = await setupAdmin('activate1');
    const createRes = await request(app).post('/api/rules').set('Cookie', cookie).send(sampleRule);
    const ruleId = createRes.body.data._id;
    expect(createRes.body.data.status).toBe('draft');

    const res = await request(app).post(`/api/rules/${ruleId}/activate`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });
});

// ─── POST /api/rules/:id/deactivate ─────────────────────────────────────────

describe('POST /api/rules/:id/deactivate', () => {
  it('admin can deactivate an active rule', async () => {
    const cookie = await setupAdmin('deactivate1');
    const createRes = await request(app).post('/api/rules').set('Cookie', cookie).send(sampleRule);
    const ruleId = createRes.body.data._id;

    // Activate first
    await request(app).post(`/api/rules/${ruleId}/activate`).set('Cookie', cookie);

    // Deactivate
    const res = await request(app).post(`/api/rules/${ruleId}/deactivate`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });
});

// ─── GET /api/rules/conflicts/all ───────────────────────────────────────────

describe('GET /api/rules/conflicts/all', () => {
  it('returns conflicts and cycles object', async () => {
    const cookie = await setupAdmin('conflicts1');
    const res = await request(app).get('/api/rules/conflicts/all').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.conflicts).toBeDefined();
    expect(res.body.data.cycles).toBeDefined();
    expect(Array.isArray(res.body.data.conflicts)).toBe(true);
    expect(Array.isArray(res.body.data.cycles)).toBe(true);
  });
});

// ─── POST /api/rules/simulations ────────────────────────────────────────────

describe('POST /api/rules/simulations', () => {
  it('runs a simulation against historical orders via HTTP', async () => {
    const cookie = await setupAdmin('sim1');

    // Create and activate a rule
    const createRes = await request(app).post('/api/rules').set('Cookie', cookie).send(sampleRule);
    const ruleId = createRes.body.data._id;
    await request(app).post(`/api/rules/${ruleId}/activate`).set('Cookie', cookie);

    // Insert test orders directly
    const lowOrder = { _id: randomUUID(), orderNumber: 'SIM-LOW', userId: 'x', state: 'submitted',
      afterSalesState: 'none', subtotal: 50, taxLines: [], taxTotal: 0, total: 50, currency: 'CNY',
      version: 1, createdAt: new Date(), updatedAt: new Date() };
    const highOrder = { _id: randomUUID(), orderNumber: 'SIM-HIGH', userId: 'x', state: 'submitted',
      afterSalesState: 'none', subtotal: 600, taxLines: [], taxTotal: 0, total: 600, currency: 'CNY',
      version: 1, createdAt: new Date(), updatedAt: new Date() };
    await getDb().collection('orders').insertMany([lowOrder, highOrder]);

    const res = await request(app).post('/api/rules/simulations').set('Cookie', cookie).send({
      ruleId,
      historicalOrderIds: [lowOrder._id, highOrder._id],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.totalOrders).toBe(2);
    expect(res.body.data.matchedCount).toBe(1);
    expect(res.body.data.matchedOrderIds).toContain(highOrder._id);
  });

  it('rejects missing ruleId', async () => {
    const cookie = await setupAdmin('sim2');
    const res = await request(app).post('/api/rules/simulations').set('Cookie', cookie)
      .send({ historicalOrderIds: ['abc'] });
    expect(res.status).toBe(400);
  });

  it('returns 403 for student', async () => {
    await usersService.createUser({
      username: 'rule_student_sim', password: 'TestPass1!@#', role: 'student', scope: {},
    });
    const cookie = await login('rule_student_sim');
    const res = await request(app).post('/api/rules/simulations').set('Cookie', cookie)
      .send({ ruleId: 'x', historicalOrderIds: ['y'] });
    expect(res.status).toBe(403);
  });
});
