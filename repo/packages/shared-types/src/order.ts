import type { UserScope } from './auth.js';

// ─── Order State Machine ───────────────────────────────────────────────────────
export type OrderState =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'paid'
  | 'allocated'
  | 'shipped'
  | 'delivered'
  | 'closed'
  | 'cancelled';

export type AfterSalesState =
  | 'none'
  | 'rma_requested'
  | 'rma_approved'
  | 'return_in_transit'
  | 'returned'
  | 'refund_pending'
  | 'refunded'
  | 'exchange_pending'
  | 'exchanged'
  | 'after_sales_closed';

// ─── Order ─────────────────────────────────────────────────────────────────────
export interface OrderTaxLine {
  description: string;
  rate: number;
  amount: number;
}

export interface Order {
  _id: string;
  orderNumber: string; // immutable, unique
  userId: string;
  userScopeSnapshot: UserScope; // captured at submission time
  state: OrderState;
  afterSalesState: AfterSalesState;
  // Invoice snapshot
  subtotal: number;
  taxLines: OrderTaxLine[];
  taxTotal: number;
  total: number;
  currency: string;
  // Lifecycle timestamps
  draftAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  deniedAt?: Date;
  paidAt?: Date;
  allocatedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  closedAt?: Date;
  cancelledAt?: Date;
  // Automation triggers
  autoCancelAt?: Date; // set on submission, cleared on payment
  autoCloseAt?: Date; // set on delivery
  // Relationships
  parentOrderId?: string; // set if this order was split from a parent
  mergedFromIds?: string[]; // set if this order was merged from others
  splitIntoIds?: string[]; // set if this order was split into children
  // Audit
  version: number; // optimistic concurrency lock
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  _id: string;
  orderId: string;
  catalogItemId: string;
  vendorId: string;
  name: string; // snapshot at order time
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface OrderNote {
  _id: string;
  orderId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface OrderTag {
  _id: string;
  orderId: string;
  tag: string;
  addedBy: string;
  addedAt: Date;
}

// ─── Cart ──────────────────────────────────────────────────────────────────────
export interface Cart {
  _id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  _id: string;
  cartId: string;
  catalogItemId: string;
  quantity: number;
  addedAt: Date;
}

// ─── Approval ─────────────────────────────────────────────────────────────────
export interface OrderApproval {
  _id: string;
  orderId: string;
  advisorId: string;
  decision: 'approved' | 'denied';
  reason?: string;
  decidedAt: Date;
}

// ─── Shipping ─────────────────────────────────────────────────────────────────
export interface ShippingRecord {
  _id: string;
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: Date;
  shippedAt: Date;
  deliveredAt?: Date;
  mentorConfirmedBy?: string;
  mentorConfirmedAt?: Date;
  conditionNote?: string;
}
