import type { UserRole } from '@nexusorder/shared-types';
import { canDo } from './canDo.js';

export interface MenuItem {
  id: string;
  label: string;
  requiredPermission?: string;
}

// Navigation items and their required permissions — shared between
// renderer (menu hide/show) and backend (route guard alignment)
export const NAV_ITEMS: MenuItem[] = [
  { id: 'catalog', label: 'Catalog', requiredPermission: 'catalog:read' },
  { id: 'orders', label: 'Orders', requiredPermission: 'orders:read' },
  { id: 'approvals', label: 'Approvals', requiredPermission: 'approvals:approve' },
  { id: 'fulfillment', label: 'Fulfillment', requiredPermission: 'fulfillment:confirm_receipt' },
  { id: 'payments', label: 'Payments', requiredPermission: 'payment_intents:read' },
  { id: 'reconciliation', label: 'Reconciliation', requiredPermission: 'reconciliation:reconcile' },
  { id: 'rules', label: 'Rules', requiredPermission: 'rules:read' },
  { id: 'audit', label: 'Audit Log', requiredPermission: 'audit:view_audit' },
  { id: 'users', label: 'Users', requiredPermission: 'users:manage_users' },
  { id: 'settings', label: 'Settings', requiredPermission: 'system:read' },
];

export function getVisibleNavItems(role: UserRole): MenuItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.requiredPermission) return true;
    const [resource, action] = item.requiredPermission.split(':') as [string, string];
    return canDo(role, `${resource}:${action}` as Parameters<typeof canDo>[1]);
  });
}
