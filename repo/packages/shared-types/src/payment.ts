// Payment intent and reconciliation types

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'paid_unreconciled'
  | 'reconciled'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface PaymentIntent {
  _id: string;
  paymentIntentId: string; // unique idempotency key
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  // Encrypted at rest (AES-256)
  paymentReferenceEncrypted?: string;
  paymentReferenceMasked?: string; // last 4 visible
  reconciliationImportId?: string;
  duplicateFlag: boolean;
  unreconciledNote?: string;
  unreconciledFlaggedBy?: string;
  unreconciledFlaggedAt?: Date;
  exceptionRepairNote?: string;
  exceptionRepairedBy?: string;
  exceptionRepairedAt?: Date;
  signatureVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationImport {
  _id: string;
  filename: string;
  importedBy: string;
  importedAt: Date;
  rowCount: number;
  validRowCount: number;
  duplicateRowCount: number;
  errorRowCount: number;
  signatureValid: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ReconciliationRow {
  _id: string;
  importId: string;
  rowIndex: number;
  paymentIntentId: string;
  amount: number;
  currency: string;
  transactionDate: Date;
  importedAt: Date;
  rawSignature: string;
  signatureValid: boolean;
  isDuplicate: boolean;
  status: 'matched' | 'unmatched' | 'duplicate' | 'exception';
  matchedPaymentIntentDocId?: string;
  processingError?: string;
}

export interface Refund {
  _id: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason: string;
  reasonCode: string;
  initiatedBy: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'issued' | 'failed';
  issuedAt?: Date;
  createdAt: Date;
}
