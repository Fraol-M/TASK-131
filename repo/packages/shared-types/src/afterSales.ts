import type { AfterSalesState } from './order.js';

export interface RMA {
  _id: string;
  orderId: string;
  requestedBy: string;
  afterSalesState: AfterSalesState;
  reasonCode: string;
  reason: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  closedAt?: Date;
}

export interface AfterSalesEvent {
  _id: string;
  orderId: string;
  rmaId?: string;
  eventType: 'rma_requested' | 'rma_approved' | 'return_shipped' | 'returned' | 'refund_issued' | 'exchange_processed' | 'closed';
  performedBy: string;
  note?: string;
  occurredAt: Date;
}

export interface ReasonCode {
  _id: string;
  code: string;
  label: string;
  applicableTo: ('return' | 'refund' | 'exchange')[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
