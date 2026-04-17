/**
 * @vitest-environment jsdom
 *
 * Behavior tests for BackupRestorePage: heading, backup list, empty state,
 * Create Backup button, restore confirmation dialog.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import BackupRestorePage from './BackupRestorePage.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function makeBackup(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'bkp-1',
    filename: 'nexusorder-2026-04-01.zip',
    destinationPath: 'D:\\Backups',
    sizeBytes: 1024 * 512,
    checksum: 'abc123',
    status: 'completed',
    triggeredBy: 'manual',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage(backups: unknown[] = [], destPath = '/backups') {
  globalThis.fetch = vi.fn((url: string) => {
    if ((url as string).includes('/api/settings/backup-destination')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: { destinationPath: destPath } }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: backups }) });
  }) as typeof fetch;

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <BackupRestorePage />
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

describe('BackupRestorePage', () => {
  it('renders Backup & Restore heading', async () => {
    renderPage();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/backup.*restore/i);
  });

  it('shows Create Backup Now button', async () => {
    renderPage();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(buttons.some((t) => /create backup/i.test(t))).toBe(true);
  });

  it('shows empty state when no backups', async () => {
    renderPage([], '/backups');
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/no backups found/i);
  });

  it('renders backup rows with filename and status', async () => {
    renderPage([makeBackup({ filename: 'backup-2026-01-01.zip', status: 'completed' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toContain('backup-2026-01-01.zip');
    expect(container.textContent).toContain('completed');
  });

  it('shows Restore button only for completed backups', async () => {
    renderPage([
      makeBackup({ _id: 'b1', status: 'completed', filename: 'good.zip' }),
      makeBackup({ _id: 'b2', status: 'failed', filename: 'bad.zip' }),
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '');
    const restoreButtons = buttons.filter((t) => /restore/i.test(t));
    // Only one Restore button for the completed backup
    expect(restoreButtons.length).toBe(1);
  });

  it('shows restore confirmation dialog when Restore is clicked', async () => {
    renderPage([makeBackup({ filename: 'confirm-test.zip', status: 'completed' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    const restoreBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /^restore$/i.test(b.textContent ?? ''),
    )!;
    act(() => { restoreBtn.click(); });

    expect(container.textContent).toMatch(/confirm restore/i);
    expect(container.textContent).toContain('confirm-test.zip');
  });

  it('shows Change button for backup destination', async () => {
    renderPage();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(buttons.some((t) => /change/i.test(t))).toBe(true);
  });
});
