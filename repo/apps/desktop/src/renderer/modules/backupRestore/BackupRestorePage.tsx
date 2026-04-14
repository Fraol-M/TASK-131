import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

interface Backup {
  _id: string;
  filename: string;
  destinationPath: string;
  sizeBytes: number;
  checksum: string;
  status: 'in_progress' | 'completed' | 'failed';
  triggeredBy: 'scheduled' | 'manual';
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface BackupDestination {
  destinationPath: string;
}

export default function BackupRestorePage() {
  const qc = useQueryClient();
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [destination, setDestination] = useState('');
  const [editingDest, setEditingDest] = useState(false);

  // ─── Fetch backup list ──────────────────────────────────────────────────
  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/backups`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load backups');
      const body = await resp.json() as { data: Backup[] };
      return body.data;
    },
  });

  // ─── Fetch current backup destination ───────────────────────────────────
  const { data: destSetting } = useQuery({
    queryKey: ['backup-destination'],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/settings/backup-destination`, { credentials: 'include' });
      if (!resp.ok) return null;
      const body = await resp.json() as { data: BackupDestination };
      return body.data;
    },
  });

  // ─── Save backup destination ────────────────────────────────────────────
  const saveDest = useMutation({
    mutationFn: async (newDest: string) => {
      const resp = await fetch(`${SERVICE_BASE}/api/settings/backup-destination`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationPath: newDest }),
      });
      if (!resp.ok) throw new Error('Failed to save destination');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup-destination'] });
      setEditingDest(false);
    },
  });

  // ─── Create backup ─────────────────────────────────────────────────────
  const createBackup = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/backups`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error('Failed to create backup');
      return resp.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  // ─── Restore from backup ───────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const resp = await fetch(`${SERVICE_BASE}/api/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: { message: 'Restore failed' } }));
        throw new Error((err as { error: { message: string } }).error.message);
      }
      return resp.json();
    },
    onSuccess: () => {
      setRestoreTarget(null);
      qc.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const handleStartEditDest = useCallback(() => {
    setDestination(destSetting?.destinationPath ?? '');
    setEditingDest(true);
  }, [destSetting]);

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) return <div style={styles.msg}>Loading backups…</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Backup &amp; Restore</h2>

      {/* Destination management */}
      <section style={styles.section}>
        <h3 style={styles.subheading}>Backup Destination</h3>
        {editingDest ? (
          <div style={styles.destRow}>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={styles.input}
              placeholder="e.g. D:\Backups\NexusOrder"
            />
            <button
              style={styles.btnPrimary}
              disabled={saveDest.isPending || !destination.trim()}
              onClick={() => saveDest.mutate(destination.trim())}
            >
              {saveDest.isPending ? 'Saving…' : 'Save'}
            </button>
            <button style={styles.btnSecondary} onClick={() => setEditingDest(false)}>Cancel</button>
          </div>
        ) : (
          <div style={styles.destRow}>
            <span style={styles.destPath}>{destSetting?.destinationPath ?? '(default)'}</span>
            <button style={styles.btnSecondary} onClick={handleStartEditDest}>Change</button>
          </div>
        )}
      </section>

      {/* Create backup */}
      <section style={styles.section}>
        <div style={styles.actionRow}>
          <h3 style={styles.subheading}>Backups</h3>
          <button
            style={styles.btnPrimary}
            disabled={createBackup.isPending}
            onClick={() => createBackup.mutate()}
          >
            {createBackup.isPending ? 'Creating…' : 'Create Backup Now'}
          </button>
        </div>
        {createBackup.isError && <p style={styles.error}>{createBackup.error.message}</p>}
      </section>

      {/* Backup list */}
      {!backups || backups.length === 0 ? (
        <p style={styles.empty}>No backups found.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              {['Filename', 'Status', 'Size', 'Date', 'Actions'].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b._id}>
                <td style={styles.td}>{b.filename}</td>
                <td style={styles.td}>
                  <span style={{ color: b.status === 'completed' ? '#4ade80' : b.status === 'failed' ? '#f87171' : '#fbbf24' }}>
                    {b.status}
                  </span>
                </td>
                <td style={styles.td}>{b.status === 'completed' ? formatSize(b.sizeBytes) : '—'}</td>
                <td style={styles.td}>{formatDate(b.startedAt)}</td>
                <td style={styles.td}>
                  {b.status === 'completed' && (
                    <button
                      style={styles.restoreBtn}
                      onClick={() => setRestoreTarget(b)}
                    >
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <div style={styles.overlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>Confirm Restore</h3>
            <p style={styles.dialogText}>
              Are you sure you want to restore from <strong>{restoreTarget.filename}</strong>?
            </p>
            <p style={styles.dialogWarning}>
              This will replace all current data with the backup contents. This action cannot be undone.
            </p>
            {restoreMutation.isError && (
              <p style={styles.error}>{restoreMutation.error.message}</p>
            )}
            <div style={styles.dialogActions}>
              <button
                style={styles.btnDanger}
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(restoreTarget._id)}
              >
                {restoreMutation.isPending ? 'Restoring…' : 'Yes, Restore'}
              </button>
              <button
                style={styles.btnSecondary}
                disabled={restoreMutation.isPending}
                onClick={() => setRestoreTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem' },
  heading: { color: '#f1f5f9', margin: '0 0 1.5rem', fontSize: 20 },
  subheading: { fontSize: 14, color: '#94a3b8', margin: 0 },
  section: { marginBottom: '1.5rem' },
  actionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  destRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  destPath: { color: '#e2e8f0', fontSize: 13 },
  input: {
    flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
    color: '#f1f5f9', padding: '0.5rem 0.75rem', fontSize: 13, outline: 'none',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { color: '#64748b', padding: '0.5rem 0.75rem', textAlign: 'left' as const, borderBottom: '1px solid #1e293b' },
  td: { color: '#e2e8f0', padding: '0.6rem 0.75rem', borderBottom: '1px solid #1e293b' },
  restoreBtn: {
    background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6',
    borderRadius: 4, padding: '0.3rem 0.7rem', fontSize: 12, cursor: 'pointer',
  },
  btnPrimary: {
    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
    padding: '0.5rem 1rem', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
  btnSecondary: {
    background: 'transparent', border: '1px solid #475569', color: '#94a3b8',
    borderRadius: 6, padding: '0.5rem 1rem', fontSize: 13, cursor: 'pointer',
  },
  btnDanger: {
    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
    padding: '0.5rem 1.2rem', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  dialog: { background: '#1e293b', borderRadius: 10, padding: '1.5rem', maxWidth: 420, width: '90%' },
  dialogTitle: { color: '#f1f5f9', margin: '0 0 0.75rem', fontSize: 16 },
  dialogText: { color: '#cbd5e1', fontSize: 13, margin: '0 0 0.5rem' },
  dialogWarning: { color: '#fbbf24', fontSize: 12, margin: '0 0 1rem' },
  dialogActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  empty: { color: '#64748b', fontSize: 14 },
  error: { color: '#f87171', fontSize: 13 },
  msg: { color: '#94a3b8', padding: 24 },
} as const;
