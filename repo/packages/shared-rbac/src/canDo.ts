import type { UserRole } from '@nexusorder/shared-types';
import type { Permission } from './permissions.js';
import { ROLE_PERMISSIONS } from './permissions.js';

/**
 * Returns true if the given role has the specified permission.
 * Used identically in Express middleware and React menu rendering.
 */
export function canDo(role: UserRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes(permission);
}

/**
 * Returns all permissions for a role.
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
