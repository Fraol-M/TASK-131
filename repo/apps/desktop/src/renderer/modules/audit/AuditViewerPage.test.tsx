/**
 * @vitest-environment jsdom
 *
 * Behavior tests for AuditViewerPage: heading, table headers, event rows, empty state, filter inputs.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from '../auth/useAuth.js';
import AuditViewerPage from './AuditViewerPage.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'evt-1',
    action: 'order.placed',
    userId: 'u1',
    targetType: 'order',
    targetId: 'ord-1',
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage(events: unknown[] = [], total = 0) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'admin1', role: 'department_admin', scope: {}, displayName: 'Admin' },
    loading: false,
    error: null,
  });

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: events, meta: { page: 1, pageSize: 50, total } }),
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <AuditViewerPage />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
  globalThis.fetch = originalFetch;
});

describe('AuditViewerPage', () => {
  it('renders Audit Log heading', () => {
    renderPage();
    expect(container.querySelector('h2')?.textContent).toMatch(/audit log/i);
  });

  it('renders two filter inputs (action and user ID)', () => {
    renderPage();
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('shows empty state when no events', async () => {
    renderPage([], 0);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/no events found/i);
  });

  it('renders table with expected column headers', async () => {
    renderPage([], 0);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('Action');
    expect(text).toContain('User ID');
    expect(text).toContain('Occurred At');
  });

  it('renders event rows with action and userId', async () => {
    renderPage([
      makeEvent({ action: 'order.approved', userId: 'adv-001', _id: 'evt-2' }),
    ], 1);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toContain('order.approved');
    expect(container.textContent).toContain('adv-001');
  });

  it('does not show pagination when total ≤ pageSize', async () => {
    renderPage([makeEvent()], 1);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    // Pagination only shows when total > 50
    const buttons = Array.from(container.querySelectorAll('button'));
    const pageButtons = buttons.filter((b) => /prev|next/i.test(b.textContent ?? ''));
    expect(pageButtons.length).toBe(0);
  });
});
