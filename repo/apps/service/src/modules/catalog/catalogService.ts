import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { CatalogItem, UserScope } from '@nexusorder/shared-types';
import { maskField } from '../../crypto/maskField.js';
import { encryptField, decryptField } from '../../crypto/aes256.js';
import { NotFoundError } from '../../middleware/errorHandler.js';

type CatalogItemInput = Omit<CatalogItem, '_id' | 'createdAt' | 'updatedAt'>;

/**
 * Decrypt the stored SKU (AES-256-GCM) and return the last 4 chars for display.
 * Safe to call on both encrypted and legacy plain-text SKU values.
 * The raw decrypted value is never returned to callers.
 */
export function maskSku(rawOrEncryptedSku: string): string {
  try {
    return maskField(decryptField(rawOrEncryptedSku));
  } catch {
    return maskField(rawOrEncryptedSku);
  }
}

function maskItem(item: CatalogItem): CatalogItem & { skuMasked: string } {
  let skuMasked: string;
  try {
    const plain = decryptField(item.sku);
    skuMasked = maskField(plain);
  } catch {
    // Fallback for items seeded before encryption was enabled (plain SKU in dev)
    skuMasked = maskField(item.sku);
  }
  return { ...item, skuMasked };
}

/**
 * Check whether a single catalog item is accessible to a user with the given scope.
 * Mirrors the MongoDB buildScopeFilter logic but runs against an in-memory document.
 */
export function isItemInScope(item: { eligibleScopes: UserScope[] }, scope: UserScope): boolean {
  const dims: Array<[keyof UserScope, string]> = [];
  if (scope.school) dims.push(['school', scope.school]);
  if (scope.major) dims.push(['major', scope.major]);
  if (scope.class) dims.push(['class', scope.class]);
  if (scope.cohort) dims.push(['cohort', scope.cohort]);

  // User has no scope dimensions — can access everything.
  if (dims.length === 0) return true;

  // Items with no scope restrictions are available to all.
  if (item.eligibleScopes.length === 0) return true;

  // At least one eligibleScopes entry must match all of the user's dimensions.
  return item.eligibleScopes.some((entry) =>
    dims.every(([field, value]) => {
      const entryValue = entry[field];
      return entryValue === undefined || entryValue === value;
    }),
  );
}

function buildScopeFilter(scope: UserScope): Record<string, unknown> {
  // Collect only the dimensions the user actually has.
  const dims: Array<[string, string]> = [];
  if (scope.school) dims.push(['school', scope.school]);
  if (scope.major) dims.push(['major', scope.major]);
  if (scope.class) dims.push(['class', scope.class]);
  if (scope.cohort) dims.push(['cohort', scope.cohort]);

  // User has no scope — can see every item (no restriction needed).
  if (dims.length === 0) return {};

  // An eligibleScopes entry matches if EVERY field present in that entry is
  // consistent with the user's scope (absent fields in the entry are wildcards).
  // This prevents a user in school=A/major=CS from seeing items scoped to
  // school=A/major=EE even though school=A matches in isolation.
  const elemMatchAnd = dims.map(([field, value]) => ({
    $or: [{ [field]: { $exists: false } }, { [field]: value }],
  }));

  return {
    $or: [
      { eligibleScopes: { $size: 0 } },                         // available to all
      { eligibleScopes: { $elemMatch: { $and: elemMatchAnd } } }, // matching entry exists
    ],
  };
}

export const catalogService = {
  async listItems(scope: UserScope, search?: string): Promise<ReturnType<typeof maskItem>[]> {
    const filter: Record<string, unknown> = {
      isAvailable: true,
      ...buildScopeFilter(scope),
    };
    if (search) filter['$text'] = { $search: search };

    const items = await getDb().collection<CatalogItem>('catalog_items').find(filter).toArray();
    return items.map(maskItem);
  },

  async getItem(id: string, scope: UserScope): Promise<ReturnType<typeof maskItem>> {
    const filter = {
      _id: id,
      isAvailable: true,
      ...buildScopeFilter(scope),
    } as Record<string, unknown>;
    const item = await getDb().collection<CatalogItem>('catalog_items').findOne(filter);
    if (!item) throw new NotFoundError('CatalogItem');
    return maskItem(item);
  },

  async createItem(data: CatalogItemInput): Promise<CatalogItem> {
    const now = new Date();
    const item: CatalogItem & { _id: string } = {
      _id: randomUUID(),
      ...data,
      sku: encryptField(data.sku),  // encrypt at rest
      createdAt: now,
      updatedAt: now,
    };
    await getDb().collection<CatalogItem>('catalog_items').insertOne(item);
    return item;
  },

  async updateItem(id: string, data: Partial<CatalogItemInput>): Promise<CatalogItem> {
    const updates = data.sku !== undefined
      ? { ...data, sku: encryptField(data.sku), updatedAt: new Date() }
      : { ...data, updatedAt: new Date() };
    await getDb().collection<CatalogItem>('catalog_items').updateOne(
      { _id: id } as { _id: string },
      { $set: updates },
    );
    const updated = await getDb().collection<CatalogItem>('catalog_items').findOne({ _id: id } as { _id: string });
    if (!updated) throw new NotFoundError('CatalogItem');
    return updated;
  },
};
