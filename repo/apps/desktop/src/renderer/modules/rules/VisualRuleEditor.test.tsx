/**
 * @vitest-environment jsdom
 *
 * Behavior tests for VisualRuleEditor: New/Edit mode titles, Cancel callback,
 * condition rows, Add Condition, Save Rule button.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import { VisualRuleEditor } from './VisualRuleEditor.js';

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
    conditions: {
      logic: 'and',
      conditions: [{ field: 'order.total', operator: 'gt', value: 1000 }],
    },
    actions: [{ type: 'block', parameters: { reason: 'Too large' } }],
    version: 1,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderEditor(rule?: ReturnType<typeof makeRule>, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <VisualRuleEditor rule={rule as never} onClose={onClose} />
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

describe('VisualRuleEditor', () => {
  it('shows "New Rule" title when no rule is provided', () => {
    renderEditor();
    expect(container.querySelector('h3')?.textContent).toMatch(/new rule/i);
  });

  it('shows "Edit Rule" title when a rule is provided', () => {
    renderEditor(makeRule());
    expect(container.querySelector('h3')?.textContent).toMatch(/edit rule/i);
  });

  it('pre-fills name input with existing rule name', () => {
    renderEditor(makeRule({ name: 'My Custom Rule' }));
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    const nameInput = inputs.find((i) => i.value === 'My Custom Rule');
    expect(nameInput).toBeDefined();
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderEditor(undefined, onClose);
    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /^cancel$/i.test(b.textContent ?? ''),
    )!;
    act(() => { cancelBtn.click(); });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows Save Rule button', () => {
    renderEditor();
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /save rule/i.test(b.textContent ?? ''),
    );
    expect(saveBtn).toBeDefined();
  });

  it('renders at least one condition row by default', () => {
    renderEditor();
    const inputs = Array.from(container.querySelectorAll('input[placeholder]')) as HTMLInputElement[];
    const conditionField = inputs.find((i) => /field/i.test(i.placeholder));
    expect(conditionField).toBeDefined();
  });

  it('Add Condition button appends a new condition row', () => {
    renderEditor();
    const countBefore = Array.from(container.querySelectorAll('input[placeholder]')).filter(
      (i) => /field/i.test((i as HTMLInputElement).placeholder),
    ).length;

    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /add condition/i.test(b.textContent ?? ''),
    )!;
    act(() => { addBtn.click(); });

    const countAfter = Array.from(container.querySelectorAll('input[placeholder]')).filter(
      (i) => /field/i.test((i as HTMLInputElement).placeholder),
    ).length;
    expect(countAfter).toBe(countBefore + 1);
  });

  it('Save Rule calls POST /api/rules for new rule', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    const onClose = vi.fn();
    renderEditor(undefined, onClose);

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /save rule/i.test(b.textContent ?? ''))!
        .click();
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([url, opts]) => (url as string).includes('/api/rules') && (opts as RequestInit).method === 'POST')).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Save Rule calls PATCH /api/rules/:id when editing an existing rule', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    const onClose = vi.fn();
    renderEditor(makeRule({ _id: 'rule-edit' }), onClose);

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /save rule/i.test(b.textContent ?? ''))!
        .click();
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([url, opts]) =>
      (url as string).includes('/api/rules/rule-edit') && (opts as RequestInit).method === 'PATCH',
    )).toBe(true);
  });
});
