import type { Order, OrderItem, OrderTaxLine } from '@nexusorder/shared-types';
import { BusinessRuleError } from '../../middleware/errorHandler.js';

const EPSILON = 0.01; // 1 cent tolerance for float arithmetic

/**
 * Validate that splitting an order into children preserves the invoice.
 * Called before any split is committed.
 */
export function validateSplitInvariant(
  parent: Order,
  children: { items: OrderItem[] }[],
): void {
  // All items must be assigned
  const parentTotalItems = children.reduce((sum, c) => sum + c.items.length, 0);
  if (parentTotalItems === 0) {
    throw new BusinessRuleError('SPLIT_INVALID', 'Split must produce at least one child with items');
  }

  // Child subtotals must sum to parent subtotal
  const childSubtotal = children.reduce(
    (sum, c) => sum + c.items.reduce((s, i) => s + i.lineTotal, 0),
    0,
  );

  if (Math.abs(childSubtotal - parent.subtotal) > EPSILON) {
    throw new BusinessRuleError(
      'SPLIT_INVOICE_MISMATCH',
      `Split subtotals (${childSubtotal.toFixed(2)}) do not match parent subtotal (${parent.subtotal.toFixed(2)})`,
    );
  }
}

/**
 * Compute proportional tax lines for a split child based on its items.
 */
export function computeChildTaxLines(items: OrderItem[]): OrderTaxLine[] {
  const taxByRate = new Map<number, number>();
  for (const item of items) {
    const taxAmount = item.lineTotal * item.taxRate;
    taxByRate.set(item.taxRate, (taxByRate.get(item.taxRate) ?? 0) + taxAmount);
  }
  return Array.from(taxByRate.entries()).map(([rate, amount]) => ({
    description: `Tax (${(rate * 100).toFixed(0)}%)`,
    rate,
    amount,
  }));
}

/**
 * Validate that merging orders is safe.
 * All source orders must have the same currency and same userId.
 */
export function validateMergeInvariant(
  orders: Order[],
  options?: { ignoreUserMismatch?: boolean },
): void {
  if (orders.length < 2) {
    throw new BusinessRuleError('MERGE_INVALID', 'Merge requires at least 2 orders');
  }

  const currencies = new Set(orders.map((o) => o.currency));
  if (currencies.size > 1) {
    throw new BusinessRuleError('MERGE_CURRENCY_MISMATCH', 'Cannot merge orders with different currencies');
  }

  if (!options?.ignoreUserMismatch) {
    const userIds = new Set(orders.map((o) => o.userId));
    if (userIds.size > 1) {
      throw new BusinessRuleError('MERGE_USER_MISMATCH', 'Cannot merge orders belonging to different users');
    }
  }
}
