import type { UserRole } from '@nexusorder/shared-types';

// Resource → allowed actions matrix
// Actions: 'read' | 'create' | 'update' | 'delete' | 'approve' | 'reconcile' | 'admin'

export type Action =
  | 'read' | 'create' | 'update' | 'delete'
  | 'approve' | 'deny'
  | 'checkout'
  | 'confirm' | 'confirm_receipt'
  | 'reconcile' | 'repair_exception'
  | 'split' | 'merge' | 'rma'
  | 'backup' | 'restore' | 'update_apply'
  | 'manage_catalog' | 'manage_users' | 'manage_rules' | 'manage_reason_codes'
  | 'view_audit'
  | 'admin';

export type Resource =
  | 'catalog' | 'vendors'
  | 'cart' | 'orders' | 'order_notes' | 'order_tags'
  | 'approvals' | 'fulfillment'
  | 'payment_intents' | 'reconciliation' | 'refunds'
  | 'rma' | 'after_sales'
  | 'rules' | 'rule_simulations'
  | 'notifications'
  | 'users' | 'blacklists'
  | 'backups' | 'restore' | 'updates'
  | 'audit'
  | 'system';

export type Permission = `${Resource}:${Action}`;

// Full permission matrix per role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  student: [
    'catalog:read',
    'vendors:read',
    'cart:create', 'cart:update', 'cart:delete',
    'orders:create', 'orders:read',
    'orders:checkout',
    'order_notes:create', 'order_notes:read',
    'order_tags:create', 'order_tags:read',
    'rma:create',
    'after_sales:read',
    'notifications:read',
  ],
  faculty_advisor: [
    'catalog:read',
    'vendors:read',
    'orders:read',
    'approvals:approve', 'approvals:deny',
    'order_notes:read', 'order_notes:create',
    'order_tags:read',
    'notifications:read',
    'audit:view_audit',
  ],
  corporate_mentor: [
    'catalog:read',
    'orders:read',
    'fulfillment:confirm_receipt',
    'order_notes:read',
    'notifications:read',
  ],
  department_admin: [
    'catalog:read', 'catalog:manage_catalog',
    'vendors:read', 'vendors:create', 'vendors:update',
    'orders:read', 'orders:admin',
    'orders:split', 'orders:merge',
    'order_notes:read', 'order_notes:create',
    'order_tags:read', 'order_tags:create',
    'approvals:approve', 'approvals:deny',
    'fulfillment:confirm_receipt',
    'payment_intents:read', 'payment_intents:confirm',
    'reconciliation:reconcile', 'reconciliation:repair_exception',
    'refunds:create', 'refunds:read',
    'rma:read', 'rma:approve',
    'after_sales:read', 'after_sales:admin',
    'rules:manage_rules', 'rules:read', 'rules:create', 'rules:update', 'rules:delete',
    'rule_simulations:create', 'rule_simulations:read',
    'notifications:read',
    'users:manage_users', 'users:read',
    'blacklists:create', 'blacklists:delete',
    'backups:backup', 'restore:restore', 'updates:update_apply',
    'audit:view_audit',
    'system:read',
    'after_sales:manage_reason_codes',
  ],
};
