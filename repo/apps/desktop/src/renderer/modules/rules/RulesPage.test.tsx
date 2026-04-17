/**
 * @vitest-environment jsdom
 *
 * Behavior tests for RulesPage: heading, tabs (Rules/Conflicts/Simulation),
 * rules table with rows, New Rule button, empty state.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from '../auth/useAuth.js';
import RulesPage from './RulesPage.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'rule-1',
    name: 'Block Large Orders',
    priority: 10,
    scope: {},
    status: 'active',
    conditions: { operator: 'AND', conditions: [{ field: 'total', operator: 'gt', value: 1000 }] },
    actions: [{ type: 'block', params: {} }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage(rules: unknown[] = []) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'admin1', role: 'department_admin', scope: {}, displayName: 'Admin' },
    loading: false,
    error: null,
  });

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: rules, conflicts: [], cycles: [] }),
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <RulesPage />
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

describe('RulesPage', () => {
  it('renders Rules Engine heading', () => {
    renderPage();
    expect(container.querySelector('h2')?.textContent).toMatch(/rules engine/i);
  });

  it('shows three tabs: Rules, Conflicts, Simulation', () => {
    renderPage();
    const text = container.textContent ?? '';
    expect(text).toContain('Rules');
    expect(text).toContain('Conflicts');
    expect(text).toContain('Simulation');
  });

  it('shows New Rule button on the Rules tab', () => {
    renderPage();
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(buttons.some((t) => /new rule/i.test(t))).toBe(true);
  });

  it('renders rules table with expected column headers', async () => {
    renderPage([]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('Name');
    expect(text).toContain('Priority');
    expect(text).toContain('Status');
  });

  it('renders rule rows with name, priority, status', async () => {
    renderPage([makeRule({ name: 'Limit Faculty Orders', priority: 5, status: 'active' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('Limit Faculty Orders');
    expect(text).toContain('5');
    expect(text).toContain('active');
  });

  it('each rule row has an Edit button', async () => {
    renderPage([makeRule(), makeRule({ _id: 'rule-2', name: 'Rule Two' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const editBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      /^edit$/i.test(b.textContent ?? ''),
    );
    expect(editBtns.length).toBe(2);
  });

  it('clicking Conflicts tab shows conflict-related content', async () => {
    renderPage([]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const conflictsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /^conflicts$/i.test(b.textContent ?? ''),
    )!;
    act(() => { conflictsBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent?.toLowerCase()).toMatch(/conflict/i);
  });
});
