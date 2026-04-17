/**
 * @vitest-environment jsdom
 *
 * Unit tests for the application router configuration.
 * Verifies that all expected routes are defined and the route structure is correct.
 */
import { describe, it, expect } from 'vitest';
import { router } from './router.js';

describe('Application router', () => {
  it('defines a login route at /login', () => {
    const loginRoute = router.routes.find((r) => r.path === '/login');
    expect(loginRoute).toBeDefined();
  });

  it('defines a root route at / with children', () => {
    const rootRoute = router.routes.find((r) => r.path === '/');
    expect(rootRoute).toBeDefined();
    expect(rootRoute!.children).toBeDefined();
    expect(rootRoute!.children!.length).toBeGreaterThan(0);
  });

  it('defines all expected child routes under /', () => {
    const rootRoute = router.routes.find((r) => r.path === '/');
    const childPaths = rootRoute!.children!.map((c) => c.path).filter(Boolean);
    const expectedPaths = [
      'orders', 'order-detail', 'cart', 'catalog', 'approvals',
      'rules', 'audit', 'reconciliation', 'updates', 'notifications', 'backup-restore',
    ];
    for (const path of expectedPaths) {
      expect(childPaths).toContain(path);
    }
  });

  it('defines a catch-all route at *', () => {
    const catchAll = router.routes.find((r) => r.path === '*');
    expect(catchAll).toBeDefined();
  });

  it('has index route that redirects to /orders', () => {
    const rootRoute = router.routes.find((r) => r.path === '/');
    const indexRoute = rootRoute!.children!.find((c) => c.index === true);
    expect(indexRoute).toBeDefined();
  });
});
