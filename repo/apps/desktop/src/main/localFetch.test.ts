import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() };
});

vi.mock('undici', () => ({
  Agent: vi.fn(() => ({})),
  fetch: vi.fn(),
}));

describe('localFetch — configureTrustAnchor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('is a no-op when certPath is empty string', async () => {
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('');
    expect(vi.mocked(fs.readFileSync)).not.toHaveBeenCalled();
  });

  it('is a no-op when cert file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('/nonexistent/cert.pem');
    expect(vi.mocked(fs.readFileSync)).not.toHaveBeenCalled();
  });

  it('reads cert and reconfigures agents when file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('CERT_DATA'));
    const { configureTrustAnchor } = await import('./localFetch.js');
    configureTrustAnchor('/valid/cert.pem');
    expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith('/valid/cert.pem');
  });
});
