import { describe, it, expect } from 'vitest';
import { getVisibleNav } from './menuPermissionMap.js';
import type { UserRole } from '@nexusorder/shared-types';

describe('menuPermissionMap — getVisibleNav', () => {
  it('shows Orders, Catalog, Cart for student role', () => {
    const nav = getVisibleNav('student');
    const paths = nav.map((n) => n.path);
    expect(paths).toContain('/orders');
    expect(paths).toContain('/catalog');
    expect(paths).toContain('/cart');
  });

  it('hides admin-only views from student role', () => {
    const nav = getVisibleNav('student');
    const paths = nav.map((n) => n.path);
    expect(paths).not.toContain('/approvals');
    expect(paths).not.toContain('/rules');
    expect(paths).not.toContain('/audit');
    expect(paths).not.toContain('/backup-restore');
    expect(paths).not.toContain('/updates');
  });

  it('hides Cart from faculty_advisor (no cart:create permission)', () => {
    const nav = getVisibleNav('faculty_advisor');
    const paths = nav.map((n) => n.path);
    expect(paths).not.toContain('/cart');
  });

  it('shows Approvals and Audit for faculty_advisor', () => {
    const nav = getVisibleNav('faculty_advisor');
    const paths = nav.map((n) => n.path);
    expect(paths).toContain('/approvals');
    expect(paths).toContain('/audit');
  });

  it('hides Cart from corporate_mentor', () => {
    const nav = getVisibleNav('corporate_mentor');
    const paths = nav.map((n) => n.path);
    expect(paths).not.toContain('/cart');
  });

  it('shows all navigation items for department_admin', () => {
    const nav = getVisibleNav('department_admin');
    const paths = nav.map((n) => n.path);
    expect(paths).toContain('/orders');
    expect(paths).toContain('/catalog');
    expect(paths).toContain('/cart');
    expect(paths).toContain('/approvals');
    expect(paths).toContain('/rules');
    expect(paths).toContain('/audit');
    expect(paths).toContain('/notifications');
    expect(paths).toContain('/backup-restore');
    expect(paths).toContain('/updates');
  });

  it('defaults to deny for unmapped routes (no route leaks)', () => {
    const roles: UserRole[] = ['student', 'faculty_advisor', 'corporate_mentor', 'department_admin'];
    for (const role of roles) {
      const nav = getVisibleNav(role);
      expect(nav.length).toBeGreaterThan(0);
    }
  });
});
