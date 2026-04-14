import { Notification as ElectronNotification, ipcMain } from 'electron';
import { windowManager } from './windowManager.js';
import type { NotificationMilestone } from '@nexusorder/shared-types';

export const notificationBridge = {
  // Called from service-layer polling or IPC events
  showNotification(params: {
    title: string;
    body: string;
    milestone: NotificationMilestone;
    relatedEntityId?: string;
  }): void {
    if (ElectronNotification.isSupported()) {
      const notif = new ElectronNotification({ title: params.title, body: params.body });
      notif.on('click', () => {
        windowManager.openMain();
        // Signal renderer to navigate to the related entity
        const mainWin = windowManager.get('main');
        mainWin?.webContents.send('navigate-to', {
          milestone: params.milestone,
          entityId: params.relatedEntityId,
        });
      });
      notif.show();
    }
  },

  showNative(title: string, body: string): void {
    if (ElectronNotification.isSupported()) {
      new ElectronNotification({ title, body }).show();
    }
  },

  register(): void {
    // 'notification:show' is the whitelisted IPC channel (see ipcSecurityRegistrar.ts).
    // showNative is called by the renderer for simple title/body toasts.
    // showNotification (with milestone routing) is called internally by the main process
    // when the service polling/push delivers a milestone event.
  },
};
