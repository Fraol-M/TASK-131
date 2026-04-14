export type NotificationMilestone =
  | 'order_placed'
  | 'order_approved'
  | 'order_denied'
  | 'order_paid'
  | 'order_shipped'
  | 'order_delivered'
  | 'refund_issued'
  | 'rma_approved'
  | 'auto_cancel_warning'
  | 'system_backup_complete'
  | 'system_recovery_needed';

export interface Notification {
  _id: string;
  userId: string;
  milestone: NotificationMilestone;
  title: string;
  body: string;
  relatedEntityType?: 'order' | 'rma' | 'payment' | 'rule';
  relatedEntityId?: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationPreference {
  _id: string;
  userId: string;
  milestone: NotificationMilestone;
  onScreen: boolean;
  updatedAt: Date;
}
