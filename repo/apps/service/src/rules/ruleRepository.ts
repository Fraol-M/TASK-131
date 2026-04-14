import { getDb } from '../persistence/mongoClient.js';
import { ObjectId } from 'mongodb';
import type { Rule } from '@nexusorder/shared-types';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('ruleRepository');

export const ruleRepository = {
  async findAll(): Promise<Rule[]> {
    const db = getDb();
    return db.collection<Rule>('rules').find().sort({ priority: 1 }).toArray() as Promise<Rule[]>;
  },

  async findActive(): Promise<Rule[]> {
    const db = getDb();
    return db.collection<Rule>('rules').find({ status: 'active' }).sort({ priority: 1 }).toArray() as Promise<Rule[]>;
  },

  async findById(id: string): Promise<Rule> {
    const db = getDb();
    const rule = await db.collection<Rule>('rules').findOne({ _id: new ObjectId(id) as unknown as string });
    if (!rule) throw new NotFoundError(`Rule ${id} not found`);
    return rule;
  },

  async create(data: Omit<Rule, '_id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<Rule> {
    const db = getDb();
    const now = new Date();
    const doc: Omit<Rule, '_id'> = { ...data, version: 1, createdAt: now, updatedAt: now };
    const result = await db.collection<Omit<Rule, '_id'>>('rules').insertOne(doc);

    // Archive version 1
    await db.collection('rule_versions').insertOne({ ruleId: result.insertedId.toHexString(), version: 1, snapshot: doc, archivedAt: now });

    log.info({ ruleId: result.insertedId }, 'Rule created');
    return { ...doc, _id: result.insertedId.toHexString() } as Rule;
  },

  async update(id: string, data: Partial<Omit<Rule, '_id' | 'createdAt'>>): Promise<Rule> {
    const db = getDb();
    const existing = await this.findById(id);
    const newVersion = existing.version + 1;
    const now = new Date();

    const result = await db.collection<Rule>('rules').findOneAndUpdate(
      { _id: new ObjectId(id) as unknown as string, version: existing.version },
      { $set: { ...data, version: newVersion, updatedAt: now } },
      { returnDocument: 'after' },
    );

    if (!result) throw new ConflictError('Rule was modified by another process — please retry');

    // Archive new version snapshot
    await db.collection('rule_versions').insertOne({
      ruleId: id, version: newVersion, snapshot: result, archivedAt: now,
    });

    return result as Rule;
  },

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.collection<Rule>('rules').deleteOne({ _id: new ObjectId(id) as unknown as string });
    log.info({ ruleId: id }, 'Rule deleted');
  },
};
