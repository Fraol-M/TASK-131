import React, { useState } from 'react';

type ImportState = 'idle' | 'importing' | 'imported' | 'applying' | 'done' | 'error';

export default function UpdateManagerPage(): React.ReactElement {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [status, setStatus] = useState<ImportState>('idle');
  const [message, setMessage] = useState<string>('');

  async function handleBrowse(): Promise<void> {
    const path = await window.nexusorder.invoke('dialog:open-file', [
      { name: 'NexusOrder Update Package', extensions: ['zip', 'nupkg'] },
    ]);
    if (path) {
      setFilePath(path);
      setPackageId(null);
      setStatus('idle');
      setMessage('');
    }
  }

  async function handleImport(): Promise<void> {
    if (!filePath) return;
    setStatus('importing');
    setMessage('');
    const result = await window.nexusorder.invoke('update:import', filePath);
    if (result.success) {
      const data = result.data as { data?: { packageId?: string } } | undefined;
      const id = data?.data?.packageId ?? null;
      setPackageId(id);
      setStatus('imported');
      setMessage(id ? `Package staged (ID: ${id})` : 'Package staged successfully.');
    } else {
      setStatus('error');
      setMessage(result.error ?? 'Import failed. Check that the file is a valid update package.');
    }
  }

  async function handleApply(): Promise<void> {
    if (!packageId) return;
    setStatus('applying');
    setMessage('');
    const result = await window.nexusorder.invoke('update:apply', packageId);
    if (result.success) {
      setStatus('done');
      setMessage('Update applied. The application will restart to complete the upgrade.');
    } else {
      setStatus('error');
      setMessage(result.error ?? 'Apply failed. The previous version remains active.');
    }
  }

  const isImporting = status === 'importing';
  const isApplying = status === 'applying';
  const busy = isImporting || isApplying;

  return (
    <div style={{ padding: '2rem', maxWidth: 600 }}>
      <h2>Update Manager</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Import a signed update package (.zip or .nupkg) then apply it. The application will
        restart automatically after a successful apply.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          readOnly
          value={filePath ?? ''}
          placeholder="No file selected"
          style={{ flex: 1, padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
        />
        <button onClick={handleBrowse} disabled={busy}>
          Browse…
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={handleImport}
          disabled={!filePath || busy || status === 'done'}
        >
          {isImporting ? 'Importing…' : 'Import'}
        </button>
        <button
          onClick={handleApply}
          disabled={!packageId || busy || status === 'done'}
        >
          {isApplying ? 'Applying…' : 'Apply'}
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 4,
            backgroundColor: status === 'error' ? '#fdecea' : status === 'done' ? '#e6f4ea' : '#e8f0fe',
            color: status === 'error' ? '#c0392b' : status === 'done' ? '#1e7e34' : '#1a4fad',
            fontSize: '0.9rem',
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
