import { contextBridge, ipcRenderer } from 'electron';
import type { IpcContract, IpcChannel } from './ipcContract.js';

/**
 * Exposes a minimal, typed bridge to the renderer via contextBridge.
 * Only channels listed here (matching ALLOWED_CHANNELS in ipcSecurityRegistrar.ts)
 * can be invoked. No direct Node/Electron access is exposed.
 */

const ALLOWED_CHANNELS: IpcChannel[] = [
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
];

type InvokeArgs<T extends IpcChannel> = Parameters<IpcContract[T]>;
type InvokeResult<T extends IpcChannel> = ReturnType<IpcContract[T]>;

const nexusorderBridge = {
  invoke<T extends IpcChannel>(channel: T, ...args: InvokeArgs<T>): InvokeResult<T> {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      throw new Error(`IPC channel "${channel}" is not whitelisted`);
    }
    return ipcRenderer.invoke(channel, ...args) as InvokeResult<T>;
  },

  onNotification(callback: (title: string, body: string) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, title: string, body: string) => {
      callback(title, body);
    };
    ipcRenderer.on('notification:push', handler);
    return () => {
      ipcRenderer.removeListener('notification:push', handler);
    };
  },
};

contextBridge.exposeInMainWorld('nexusorder', nexusorderBridge);

export type NexusOrderBridge = typeof nexusorderBridge;
