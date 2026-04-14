import { ipcMain, shell, dialog, session } from 'electron';
import os from 'os';
import { createHash } from 'crypto';
import { windowManager } from './windowManager.js';
import { notificationBridge } from './notificationBridge.js';
import { localFetch } from './localFetch.js';

const SERVICE_URL = `https://127.0.0.1:${process.env['SERVICE_PORT'] ?? '4433'}`;

// Whitelist of all IPC channels that the renderer may invoke.
// Any channel not registered here will be ignored by the main process.
const ALLOWED_CHANNELS = new Set([
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
]);

/**
 * Reads the HttpOnly session cookie from Electron's cookie store.
 * This is the only safe way to access it — the renderer cannot read HttpOnly cookies.
 */
async function getSessionCookieHeader(): Promise<string> {
  const cookies = await session.defaultSession.cookies.get({ url: SERVICE_URL, name: 'nexusorder_session' });
  if (cookies.length > 0) {
    return `nexusorder_session=${cookies[0]!.value}`;
  }
  return '';
}

export const ipcSecurityRegistrar = {
  register(): void {
    notificationBridge.register();

    ipcMain.handle('window:open-order-detail', (_event, orderId: string) => {
      windowManager.openOrderDetail(orderId);
    });

    ipcMain.handle('window:open-reconciliation', () => {
      windowManager.openReconciliation();
    });

    ipcMain.handle('window:open-rules-editor', () => {
      windowManager.openRulesEditor();
    });

    ipcMain.handle('window:open-audit-viewer', () => {
      windowManager.openAuditViewer();
    });

    ipcMain.handle('notification:show', (_event, title: string, body: string) => {
      notificationBridge.showNative(title, body);
    });

    // Opens a native file picker; returns the selected path or null if cancelled.
    ipcMain.handle('dialog:open-file', async (_event, filters?: { name: string; extensions: string[] }[]) => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
      });
      return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]!;
    });

    // Collect hardware/OS fingerprint in the main process (renderer has no access to os module)
    // and send the SHA-256 hash to the service. Raw source values are never sent to the service.
    ipcMain.handle('fingerprint:submit', async () => {
      try {
        const raw = [
          os.hostname(),
          os.platform(),
          os.arch(),
          os.cpus()[0]?.model ?? 'unknown',
          String(os.totalmem()),
          os.release(),
        ].join('|');
        const fingerprintHash = createHash('sha256').update(raw).digest('hex');

        const cookieHeader = await getSessionCookieHeader();
        const resp = await localFetch(`${SERVICE_URL}/api/users/fingerprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
          body: JSON.stringify({ fingerprintHash }),
        });
        return { success: resp.ok, status: resp.status };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle('fingerprint:consent', async (_event, consentGiven: boolean) => {
      try {
        const cookieHeader = await getSessionCookieHeader();
        const resp = await localFetch(`${SERVICE_URL}/api/users/consent/fingerprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
          body: JSON.stringify({ consentGiven }),
        });
        return { success: resp.ok, status: resp.status };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });
  },
};
