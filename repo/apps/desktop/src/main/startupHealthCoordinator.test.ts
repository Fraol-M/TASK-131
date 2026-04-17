import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./localFetch.js', () => ({
  localFetch: vi.fn(),
}));

vi.mock('@nexusorder/shared-logging', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { localFetch } from './localFetch.js';

describe('startupHealthCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns true when service status is ok', async () => {
    vi.mocked(localFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { status: 'ok' } }),
    });
    const { startupHealthCoordinator } = await import('./startupHealthCoordinator.js');
    expect(await startupHealthCoordinator.check()).toBe(true);
  });

  it('returns true when service status is degraded (not unhealthy)', async () => {
    vi.mocked(localFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { status: 'degraded' } }),
    });
    const { startupHealthCoordinator } = await import('./startupHealthCoordinator.js');
    expect(await startupHealthCoordinator.check()).toBe(true);
  });

  it('returns false (fail-closed) when service status is unhealthy', async () => {
    vi.mocked(localFetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ data: { status: 'unhealthy' } }),
    });
    const { startupHealthCoordinator } = await import('./startupHealthCoordinator.js');
    expect(await startupHealthCoordinator.check()).toBe(false);
  });

  it('returns false (fail-closed) when localFetch throws (unreachable service)', async () => {
    vi.mocked(localFetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const { startupHealthCoordinator } = await import('./startupHealthCoordinator.js');
    expect(await startupHealthCoordinator.check()).toBe(false);
  });
});
