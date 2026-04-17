import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

vi.mock('undici', () => ({
  Agent: vi.fn(() => ({})),
  fetch: vi.fn(),
}));

describe('localFetch — configureTrustAnchor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('is a no-op when certPath is empty string', async () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('');
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when cert file does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const readSpy = vi.spyOn(fs, 'readFileSync');
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('/nonexistent/cert.pem');
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('reads cert and reconfigures agents when file exists', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('CERT_DATA') as never);
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('/valid/cert.pem');
    expect(readSpy).toHaveBeenCalledWith('/valid/cert.pem');
  });
});
