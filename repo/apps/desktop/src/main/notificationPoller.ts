/**
 * notificationPoller — background interval that fetches unread notifications
 * from the service and pushes them to the renderer.
 *
 * Pipeline:
 *   service (persists notifications) → localFetch poll (main process)
 *     → notificationBridge.showNotification (OS toast + click-to-navigate)
 *     → webContents.send('notification:push') (renderer NotificationsPage live update)
 *
 * Started from appLifecycleManager after windows open; stopped on before-quit.
 */

import { BrowserWindow, session } from 'electron';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { localFetch } from './localFetch.js';
import { notificationBridge } from './notificationBridge.js';

const log = createModuleLogger('notificationPoller');

const SERVICE_URL = `https://127.0.0.1:${process.env['SERVICE_PORT'] ?? '4433'}`;
const POLL_INTERVAL_MS = 30_000;

// IDs that have already been shown this session — prevents duplicate toasts on re-poll.
const seenIds = new Set<string>();

let pollTimer: ReturnType<typeof setInterval> | null = null;

interface ServiceNotification {
  _id: string;
  title: string;
  body: string;
  milestone: string;
  relatedEntityId?: string;
  read: boolean;
}

async function getSessionCookieHeader(): Promise<string> {
  const cookies = await session.defaultSession.cookies.get({
    url: SERVICE_URL,
    name: 'nexusorder_session',
  });
  return cookies.length > 0 ? `nexusorder_session=${cookies[0]!.value}` : '';
}

async function pollOnce(): Promise<void> {
  const cookieHeader = await getSessionCookieHeader();
  if (!cookieHeader) return; // no active session — skip until user logs in

  let notifications: ServiceNotification[] = [];
  try {
    const res = await localFetch(`${SERVICE_URL}/api/notifications?unread=true`, {
      headers: { Cookie: cookieHeader },
    });
    if (!res.ok) return;
    const body = await res.json<{ data: ServiceNotification[] }>();
    notifications = body.data ?? [];
  } catch {
    // Service unreachable (app shutting down, health check pending, etc.) — silent skip
    return;
  }

  const newNotifications = notifications.filter((n) => !seenIds.has(n._id));
  if (newNotifications.length === 0) return;

  for (const n of newNotifications) {
    seenIds.add(n._id);

    // OS-level toast + click-to-navigate
    notificationBridge.showNotification({
      title: n.title,
      body: n.body,
      milestone: n.milestone as Parameters<typeof notificationBridge.showNotification>[0]['milestone'],
      relatedEntityId: n.relatedEntityId,
    });

    // In-app live update for the renderer NotificationsPage
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('notification:push', n.title, n.body);
      }
    }
  }

  log.info({ count: newNotifications.length }, 'Pushed new notifications to renderer');
}

export const notificationPoller = {
  start(): void {
    if (pollTimer) return;
    // Initial poll shortly after start so the user sees notifications quickly
    setTimeout(() => void pollOnce(), 3_000);
    pollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
    log.info({ intervalMs: POLL_INTERVAL_MS }, 'Notification poller started');
  },

  stop(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      log.info('Notification poller stopped');
    }
  },
};
