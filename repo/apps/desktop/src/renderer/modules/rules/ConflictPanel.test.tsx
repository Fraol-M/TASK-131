/**
 * @vitest-environment jsdom
 *
 * Behavior tests for ConflictPanel: empty state, conflict cards, remediation suggestions.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import { ConflictPanel } from './ConflictPanel.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function makeConflict(overrides: Record<string, unknown> = {}) {
  return {
    ruleIds: ['rule-a', 'rule-b'],
    conflictType: 'overlapping_scope',
    description: 'These rules overlap in scope and may produce conflicting outcomes.',
    remediationSuggestions: [
      { type: 'increase_priority', description: 'Raise priority of the dominant rule.' },
    ],
    ...overrides,
  };
}

function renderPanel(conflicts: unknown[] = []) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: conflicts }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <ConflictPanel />
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

describe('ConflictPanel', () => {
  it('shows no-conflict message when list is empty', async () => {
    renderPanel([]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/no conflicts detected/i);
  });

  it('renders conflict card with type and description', async () => {
    renderPanel([makeConflict()]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/overlapping scope/i);
    expect(container.textContent).toContain('These rules overlap in scope');
  });

  it('renders remediation suggestions when present', async () => {
    renderPanel([makeConflict()]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/suggestions/i);
    expect(container.textContent).toContain('Raise priority of the dominant rule.');
  });

  it('renders multiple conflict cards', async () => {
    renderPanel([
      makeConflict({ ruleIds: ['r1', 'r2'], conflictType: 'cycle' }),
      makeConflict({ ruleIds: ['r3', 'r4'], conflictType: 'duplicate_action', description: 'Duplicate action found.' }),
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/cycle/i);
    expect(container.textContent).toMatch(/duplicate action/i);
  });

  it('omits suggestions section when remediationSuggestions is empty', async () => {
    renderPanel([makeConflict({ remediationSuggestions: [] })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).not.toMatch(/suggestions:/i);
  });
});
