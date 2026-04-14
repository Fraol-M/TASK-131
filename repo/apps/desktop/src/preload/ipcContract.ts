/**
 * Typed IPC surface — the only API the renderer is allowed to call.
 * All channel names here must also appear in ipcSecurityRegistrar.ts ALLOWED_CHANNELS
 * and secureBridge.ts ALLOWED_CHANNELS.
 */
export interface IpcContract {
  // Window management
  'window:open-order-detail': (orderId: string) => Promise<void>;
  'window:open-reconciliation': () => Promise<void>;
  'window:open-rules-editor': () => Promise<void>;
  'window:open-audit-viewer': () => Promise<void>;

  // Notifications
  'notification:show': (title: string, body: string) => Promise<void>;

  // File dialog — opens a native file picker; returns the selected path or null if cancelled.
  'dialog:open-file': (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;

  // Update management — session cookie is read from Electron's cookie store in the main
  // process; renderer cannot access HttpOnly cookies, so it does not pass them here.
  'update:import': (filePath: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  'update:apply': (packageId: string) => Promise<{ success: boolean; data?: unknown; requiresRestart?: boolean; error?: string }>;

  // Device fingerprinting — collected by main process (has os module access);
  // session cookie is read from Electron's cookie store, not passed by the renderer.
  'fingerprint:submit': () => Promise<{ success: boolean; status?: number; error?: string }>;
  'fingerprint:consent': (consentGiven: boolean) => Promise<{ success: boolean; status?: number; error?: string }>;
}

export type IpcChannel = keyof IpcContract;
