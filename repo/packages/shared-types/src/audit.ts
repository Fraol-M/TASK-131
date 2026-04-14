export type AuditAction =
  // Auth
  | 'auth.login' | 'auth.logout' | 'auth.login_failed' | 'auth.lockout'
  | 'auth.password_changed'
  // Orders
  | 'order.submitted' | 'order.approved' | 'order.denied' | 'order.paid'
  | 'order.allocated' | 'order.shipped' | 'order.delivered' | 'order.closed'
  | 'order.cancelled' | 'order.split' | 'order.merged'
  // Cart
  | 'cart.checkout_throttled'
  // After-sales
  | 'rma.requested' | 'rma.approved' | 'refund.issued' | 'exchange.processed'
  // Payment
  | 'payment.reconciliation_imported' | 'payment.reconciliation_import_rejected'
  | 'payment.duplicate_flagged' | 'payment.exception_repaired'
  | 'payment.flagged_unreconciled'
  // Rules
  | 'rule.created' | 'rule.updated' | 'rule.activated' | 'rule.deactivated'
  | 'rule.simulation_run'
  // Admin
  | 'blacklist.added' | 'blacklist.removed'
  | 'backup.created' | 'restore.performed'
  | 'update.imported' | 'update.applied' | 'update.rolled_back'
  | 'recovery.performed';

export interface AuditEvent {
  _id: string;
  action: AuditAction;
  userId?: string; // actor
  targetType?: string; // 'order' | 'user' | 'rule' | 'payment' | etc.
  targetId?: string;
  correlationId?: string;
  meta?: Record<string, unknown>; // no sensitive fields — redacted at source
  occurredAt: Date;
}
