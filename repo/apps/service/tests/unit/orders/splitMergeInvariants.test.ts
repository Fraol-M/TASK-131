import { describe, it, expect } from 'vitest';
import { validateSplitInvariant, validateMergeInvariant, computeChildTaxLines } from '../../../src/modules/orderMutations/splitMergeInvariants.js';
import type { Order, OrderItem } from '@nexusorder/shared-types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    _id: 'ord1', orderNumber: 'NO-00000001', userId: 'u1',
    userScopeSnapshot: {}, state: 'submitted', afterSalesState: 'none',
    subtotal: 100, taxLines: [], taxTotal: 8, total: 108, currency: 'USD',
    version: 1, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeItem(id: string, lineTotal: number, taxRate = 0.08): OrderItem {
  return {
    _id: id, orderId: 'ord1', catalogItemId: 'cat1', vendorId: 'v1',
    name: 'Test', sku: 'SKU1', quantity: 1, unitPrice: lineTotal,
    taxRate, lineTotal,
  };
}

describe('splitMergeInvariants', () => {
  describe('validateSplitInvariant', () => {
    it('passes when child subtotals sum to parent subtotal', () => {
      const parent = makeOrder({ subtotal: 100 });
      const children = [
        { items: [makeItem('a', 60)] },
        { items: [makeItem('b', 40)] },
      ];
      expect(() => validateSplitInvariant(parent, children)).not.toThrow();
    });

    it('throws when child subtotals do not match parent', () => {
      const parent = makeOrder({ subtotal: 100 });
      const children = [
        { items: [makeItem('a', 60)] },
        { items: [makeItem('b', 30)] }, // 10 short
      ];
      expect(() => validateSplitInvariant(parent, children)).toThrow('SPLIT_INVOICE_MISMATCH');
    });

    it('throws when no items are provided', () => {
      const parent = makeOrder({ subtotal: 100 });
      expect(() => validateSplitInvariant(parent, [])).toThrow('SPLIT_INVALID');
    });
  });

  describe('validateMergeInvariant', () => {
    it('passes for same user and same currency', () => {
      const orders = [makeOrder({ _id: '1', userId: 'u1', currency: 'USD' }), makeOrder({ _id: '2', userId: 'u1', currency: 'USD' })];
      expect(() => validateMergeInvariant(orders)).not.toThrow();
    });

    it('throws when currencies differ', () => {
      const orders = [makeOrder({ _id: '1', currency: 'USD' }), makeOrder({ _id: '2', currency: 'CNY' })];
      expect(() => validateMergeInvariant(orders)).toThrow('MERGE_CURRENCY_MISMATCH');
    });

    it('throws when user IDs differ', () => {
      const orders = [makeOrder({ _id: '1', userId: 'u1' }), makeOrder({ _id: '2', userId: 'u2' })];
      expect(() => validateMergeInvariant(orders)).toThrow('MERGE_USER_MISMATCH');
    });

    it('throws when only one order is provided', () => {
      expect(() => validateMergeInvariant([makeOrder()])).toThrow('MERGE_INVALID');
    });
  });

  describe('computeChildTaxLines', () => {
    it('groups tax by rate', () => {
      const items = [makeItem('a', 100, 0.08), makeItem('b', 50, 0.08), makeItem('c', 40, 0.13)];
      const lines = computeChildTaxLines(items);
      expect(lines).toHaveLength(2);
      const line8 = lines.find((l) => l.rate === 0.08)!;
      expect(line8.amount).toBeCloseTo(12); // 150 * 0.08
    });
  });
});
