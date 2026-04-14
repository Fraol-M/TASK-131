import type { OrderState, AfterSalesState } from '@nexusorder/shared-types';
import { BusinessRuleError } from '../../middleware/errorHandler.js';

// ─── Primary order lifecycle transitions ─────────────────────────────────────
// The only valid transitions. Any attempt outside this map is rejected.
export const ORDER_TRANSITIONS: Record<OrderState, OrderState[]> = {
  draft:     ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved:  ['paid', 'cancelled'],
  paid:      ['allocated'],
  allocated: ['shipped'],
  shipped:   ['delivered'],
  delivered: ['closed'],
  closed:    [],
  cancelled: [],
};

/**
 * Assert that the transition from `from` to `to` is valid.
 * Throws BusinessRuleError if not.
 */
export function guardTransition(from: OrderState, to: OrderState): void {
  const allowed = ORDER_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BusinessRuleError(
      'INVALID_STATE_TRANSITION',
      `Order cannot transition from '${from}' to '${to}'. Allowed: [${allowed.join(', ')}]`,
    );
  }
}

// ─── After-sales sub-state transitions ───────────────────────────────────────
export const AFTER_SALES_TRANSITIONS: Record<AfterSalesState, AfterSalesState[]> = {
  none:              ['rma_requested'],
  rma_requested:     ['rma_approved'],
  rma_approved:      ['return_in_transit'],
  return_in_transit: ['returned'],
  returned:          ['refund_pending', 'exchange_pending'],
  refund_pending:    ['refunded'],
  refunded:          ['after_sales_closed'],
  exchange_pending:  ['exchanged'],
  exchanged:         ['after_sales_closed'],
  after_sales_closed: [],
};

export function guardAfterSalesTransition(from: AfterSalesState, to: AfterSalesState): void {
  const allowed = AFTER_SALES_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BusinessRuleError(
      'INVALID_AFTER_SALES_TRANSITION',
      `After-sales cannot transition from '${from}' to '${to}'. Allowed: [${allowed.join(', ')}]`,
    );
  }
}

// ─── States eligible for RMA creation ────────────────────────────────────────
export const RMA_ELIGIBLE_STATES: OrderState[] = ['delivered', 'closed'];

export function assertRmaEligible(state: OrderState): void {
  if (!RMA_ELIGIBLE_STATES.includes(state)) {
    throw new BusinessRuleError(
      'ORDER_NOT_ELIGIBLE_FOR_RMA',
      `RMA can only be created for orders in state [${RMA_ELIGIBLE_STATES.join(', ')}]. Current: '${state}'`,
    );
  }
}

// ─── States eligible for split/merge ─────────────────────────────────────────
export const SPLIT_ELIGIBLE_STATES: OrderState[] = ['submitted', 'approved'];
export const MERGE_ELIGIBLE_STATES: OrderState[] = ['draft', 'submitted'];

export function assertSplitEligible(state: OrderState): void {
  if (!SPLIT_ELIGIBLE_STATES.includes(state)) {
    throw new BusinessRuleError('ORDER_NOT_SPLITTABLE', `Order in state '${state}' cannot be split.`);
  }
}

export function assertMergeEligible(state: OrderState): void {
  if (!MERGE_ELIGIBLE_STATES.includes(state)) {
    throw new BusinessRuleError('ORDER_NOT_MERGEABLE', `Order in state '${state}' cannot be merged.`);
  }
}
