import { ipcMain, session } from 'electron';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { localFetch, localFetchForm } from './localFetch.js';
import { serviceManager } from './serviceManager.js';

const log = createModuleLogger('updateImportManager');

const SERVICE_URL = `https://127.0.0.1:${process.env['SERVICE_PORT'] ?? '4433'}`;

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

export const updateImportManager = {
  initialize(): void {
    ipcMain.handle('update:import', async (_event, filePath: string) => {
      log.info({ filePath }, 'Update import requested');
      try {
        const fs = await import('fs');
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer]);
        formData.append('package', blob, filePath.split('/').pop() ?? 'update.zip');

        const cookieHeader = await getSessionCookieHeader();
        const resp = await localFetchForm(`${SERVICE_URL}/api/updates/import`, {
          method: 'POST',
          headers: {
            'x-internal-key': serviceManager.getInternalApiKey(),
            'x-actor-id': 'internal:desktop',
            'Cookie': cookieHeader,
          },
          body: formData,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error((err as { message?: string }).message ?? 'Import failed');
        }

        const result = await resp.json();
        log.info({ result }, 'Update import succeeded');
        return { success: true, data: result };
      } catch (err) {
        log.error({ err }, 'Update import failed');
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle('update:apply', async (_event, packageId: string) => {
      log.info({ packageId }, 'Update apply requested');
      try {
        const cookieHeader = await getSessionCookieHeader();
        const resp = await localFetch(`${SERVICE_URL}/api/updates/${packageId}/apply`, {
          method: 'POST',
          headers: {
            'x-internal-key': serviceManager.getInternalApiKey(),
            'x-actor-id': 'internal:desktop',
            'Cookie': cookieHeader,
          },
        });

        if (!resp.ok) {
          const err = await resp.json<{ message?: string }>().catch(() => ({ message: 'Apply failed' }));
          throw new Error(err.message ?? 'Apply failed');
        }

        const result = await resp.json();
        log.info({ result }, 'Update apply succeeded — restart required');
        return { success: true, data: result, requiresRestart: true };
      } catch (err) {
        log.error({ err }, 'Update apply failed');
        return { success: false, error: (err as Error).message };
      }
    });
  },
};
