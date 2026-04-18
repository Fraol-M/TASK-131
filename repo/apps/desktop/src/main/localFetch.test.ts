import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

vi.mock('undici', () => ({
  Agent: vi.fn(() => ({})),
  fetch: vi.fn(),
}));

vi.mock('fs', () => {
  const fsMock = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };

  return {
    default: fsMock,
    ...fsMock,
  };
});

describe('localFetch — configureTrustAnchor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('is a no-op when certPath is empty string', async () => {
    const readSpy = vi.mocked(fs.readFileSync);
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('');
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when cert file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const readSpy = vi.mocked(fs.readFileSync);
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('/nonexistent/cert.pem');
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('reads cert and reconfigures agents when file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const readSpy = vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('CERT_DATA') as never);
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('/valid/cert.pem');
    expect(readSpy).toHaveBeenCalledWith('/valid/cert.pem');
  });
});
