import { randomUUID } from 'crypto';
import { getDb } from '../persistence/mongoClient.js';
import type { Rule, RuleVersion, RuleConflict } from '@nexusorder/shared-types';
import { detectConflicts, detectCircularDependencies } from './conflictDetector.js';
import { emitAuditEvent } from '../audit/auditLog.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export const ruleService = {
  async listRules(status?: Rule['status']): Promise<Rule[]> {
    const filter = status ? { status } : {};
    return getDb().collection<Rule>('rules').find(filter).sort({ priority: 1, updatedAt: -1 }).toArray();
  },

  async getRule(id: string): Promise<Rule> {
    const rule = await getDb().collection<Rule>('rules').findOne({ _id: id } as { _id: string });
    if (!rule) throw new NotFoundError('Rule');
    return rule;
  },

  async createRule(data: Omit<Rule, '_id' | 'version' | 'createdAt' | 'updatedAt'>, createdBy: string): Promise<Rule> {
    const now = new Date();
    const rule: Rule & { _id: string } = {
      _id: randomUUID(),
      ...data,
      status: 'draft',
      version: 1,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await getDb().collection<Rule>('rules').insertOne(rule);
    await this._saveVersion(rule);
    await emitAuditEvent({ action: 'rule.created', userId: createdBy, targetType: 'rule', targetId: rule._id });
    return rule;
  },

  async updateRule(id: string, data: Partial<Rule>, updatedBy: string): Promise<Rule> {
    const existing = await this.getRule(id);
    const now = new Date();
    const updated: Rule = {
      ...existing,
      ...data,
      _id: id,
      version: existing.version + 1,
      updatedBy,
      updatedAt: now,
    };

    await getDb().collection<Rule>('rules').replaceOne({ _id: id } as { _id: string }, updated);
    await this._saveVersion(updated);
    await emitAuditEvent({ action: 'rule.updated', userId: updatedBy, targetType: 'rule', targetId: id });
    return updated;
  },

  async activateRule(id: string, userId: string): Promise<Rule> {
    const rule = await this.updateRule(id, { status: 'active' }, userId);
    await emitAuditEvent({ action: 'rule.activated', userId, targetType: 'rule', targetId: id });
    // Re-run conflict detection
    const allActive = await this.listRules('active');
    await this.saveConflicts(allActive);
    return rule;
  },

  async deactivateRule(id: string, userId: string): Promise<Rule> {
    const rule = await this.updateRule(id, { status: 'inactive' }, userId);
    await emitAuditEvent({ action: 'rule.deactivated', userId, targetType: 'rule', targetId: id });
    return rule;
  },

  async detectAndGetConflicts(): Promise<{ conflicts: Omit<RuleConflict, '_id' | 'detectedAt'>[]; cycles: string[][] }> {
    const activeRules = await this.listRules('active');
    const conflicts = detectConflicts(activeRules);
    const cycles = detectCircularDependencies(activeRules);
    return { conflicts, cycles };
  },

  async saveConflicts(rules: Rule[]): Promise<void> {
    const conflicts = detectConflicts(rules);
    const now = new Date();
    for (const c of conflicts) {
      await getDb().collection<RuleConflict>('rule_conflicts').updateOne(
        { ruleIds: { $all: c.ruleIds }, resolvedAt: { $exists: false } },
        { $setOnInsert: { _id: randomUUID(), ...c, detectedAt: now } },
        { upsert: true },
      );
    }
  },

  async _saveVersion(rule: Rule): Promise<void> {
    const version: RuleVersion & { _id: string } = {
      _id: randomUUID(),
      ruleId: rule._id,
      version: rule.version,
      snapshot: rule,
      createdBy: rule.updatedBy,
      createdAt: new Date(),
    };
    await getDb().collection<RuleVersion>('rule_versions').insertOne(version);
  },
};
