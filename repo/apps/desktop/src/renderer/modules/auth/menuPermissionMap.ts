import { canDo } from '@nexusorder/shared-rbac';
import type { UserRole } from '@nexusorder/shared-types';

export interface NavItem {
  label: string;
  path: string;
  shortcut?: string;
}

const ALL_NAV: NavItem[] = [
  { label: 'Orders', path: '/orders', shortcut: 'Alt+1' },
  { label: 'Catalog', path: '/catalog' },
  { label: 'Cart', path: '/cart' },
  { label: 'Approvals', path: '/approvals' },
  { label: 'Rules', path: '/rules', shortcut: 'Alt+2' },
  { label: 'Audit Log', path: '/audit' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Backup/Restore', path: '/backup-restore' },
  { label: 'Updates', path: '/updates' },
];

const ROUTE_PERMISSION: Record<string, Parameters<typeof canDo>[1]> = {
  '/orders': 'orders:read',
  '/catalog': 'catalog:read',
  '/cart': 'cart:create',
  '/approvals': 'approvals:approve',
  '/rules': 'rules:read',
  '/audit': 'audit:view_audit',
  '/updates': 'updates:update_apply',
  '/notifications': 'notifications:read',
  '/backup-restore': 'backups:backup',
};

export function getVisibleNav(role: UserRole): NavItem[] {
  return ALL_NAV.filter((item) => {
    const required = ROUTE_PERMISSION[item.path];
    // Default-deny: unmapped routes are hidden to prevent accidental exposure
    if (!required) return false;
    return canDo(role, required);
  });
}
