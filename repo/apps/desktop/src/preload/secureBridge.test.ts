/**
 * Unit tests for the IPC allowlist in secureBridge.
 * The allowlist is the security boundary: only explicitly listed channels
 * may be invoked. Anything else must throw synchronously.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: mockInvoke, on: mockOn, removeListener: mockRemoveListener },
}));

const ALLOWED_CHANNELS = [
  'window:open-order-detail',
  'window:open-reconciliation',
  'window:open-rules-editor',
  'window:open-audit-viewer',
  'notification:show',
  'dialog:open-file',
  'update:import',
  'update:apply',
  'fingerprint:submit',
  'fingerprint:consent',
] as const;

describe('secureBridge IPC allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exposes nexusorder bridge via contextBridge.exposeInMainWorld', async () => {
    const { contextBridge } = await import('electron');
    await import('./secureBridge.js');
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('nexusorder', expect.any(Object));
  });

  for (const channel of ALLOWED_CHANNELS) {
    it(`allows whitelisted channel: ${channel}`, async () => {
      const { contextBridge } = await import('electron');
      await import('./secureBridge.js');
      const bridge = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0]?.[1] as {
        invoke: (channel: string, ...args: unknown[]) => unknown;
      };
      bridge.invoke(channel);
      expect(mockInvoke).toHaveBeenCalledWith(channel);
    });
  }

  it('throws for an unlisted channel', async () => {
    vi.resetModules();
    const { contextBridge } = await import('electron');
    await import('./secureBridge.js');
    const bridge = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0]?.[1] as {
      invoke: (channel: string, ...args: unknown[]) => unknown;
    };
    expect(() => bridge.invoke('evil:channel')).toThrow(/not whitelisted/);
  });

  it('onNotification registers and returns a cleanup function', async () => {
    vi.resetModules();
    const { contextBridge } = await import('electron');
    await import('./secureBridge.js');
    const bridge = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0]?.[1] as {
      onNotification: (cb: (title: string, body: string) => void) => () => void;
    };
    const cb = vi.fn();
    const cleanup = bridge.onNotification(cb);
    expect(mockOn).toHaveBeenCalledWith('notification:push', expect.any(Function));
    cleanup();
    expect(mockRemoveListener).toHaveBeenCalled();
  });
});
