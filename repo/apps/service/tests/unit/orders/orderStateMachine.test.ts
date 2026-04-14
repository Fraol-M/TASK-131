import { describe, it, expect } from 'vitest';
import { guardTransition, guardAfterSalesTransition, assertRmaEligible } from '../../../src/modules/orders/orderStateMachine.js';

describe('orderStateMachine', () => {
  describe('primary lifecycle', () => {
    it('allows draft → submitted', () => {
      expect(() => guardTransition('draft', 'submitted')).not.toThrow();
    });

    it('allows submitted → approved', () => {
      expect(() => guardTransition('submitted', 'approved')).not.toThrow();
    });

    it('allows approved → paid', () => {
      expect(() => guardTransition('approved', 'paid')).not.toThrow();
    });

    it('allows paid → allocated', () => {
      expect(() => guardTransition('paid', 'allocated')).not.toThrow();
    });

    it('allows allocated → shipped', () => {
      expect(() => guardTransition('allocated', 'shipped')).not.toThrow();
    });

    it('allows shipped → delivered', () => {
      expect(() => guardTransition('shipped', 'delivered')).not.toThrow();
    });

    it('allows delivered → closed', () => {
      expect(() => guardTransition('delivered', 'closed')).not.toThrow();
    });

    it('rejects draft → shipped (invalid skip)', () => {
      expect(() => guardTransition('draft', 'shipped')).toThrow('INVALID_STATE_TRANSITION');
    });

    it('rejects closed → any', () => {
      expect(() => guardTransition('closed', 'submitted')).toThrow('INVALID_STATE_TRANSITION');
    });

    it('rejects cancelled → approved', () => {
      expect(() => guardTransition('cancelled', 'approved')).toThrow('INVALID_STATE_TRANSITION');
    });
  });

  describe('after-sales state machine', () => {
    it('allows none → rma_requested', () => {
      expect(() => guardAfterSalesTransition('none', 'rma_requested')).not.toThrow();
    });

    it('rejects none → refunded (invalid skip)', () => {
      expect(() => guardAfterSalesTransition('none', 'refunded')).toThrow('INVALID_AFTER_SALES_TRANSITION');
    });
  });

  describe('RMA eligibility', () => {
    it('allows RMA from delivered state', () => {
      expect(() => assertRmaEligible('delivered')).not.toThrow();
    });

    it('allows RMA from closed state', () => {
      expect(() => assertRmaEligible('closed')).not.toThrow();
    });

    it('rejects RMA from submitted state', () => {
      expect(() => assertRmaEligible('submitted')).toThrow('ORDER_NOT_ELIGIBLE_FOR_RMA');
    });

    it('rejects RMA from paid state', () => {
      expect(() => assertRmaEligible('paid')).toThrow('ORDER_NOT_ELIGIBLE_FOR_RMA');
    });
  });
});
