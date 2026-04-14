import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

interface ReconciliationRow {
  _id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: 'matched' | 'unmatched' | 'duplicate' | 'exception';
  importedAt: string;
}

export default function ReconciliationWindow() {
  const qc = useQueryClient();
  const [repairNote, setRepairNote] = useState('');
  const [repairTarget, setRepairTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/payments/reconciliation`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load reconciliation data');
      const body = await resp.json() as { data: ReconciliationRow[] };
      return body.data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch(`${SERVICE_BASE}/api/payments/reconciliation/import`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Import failed' }));
        throw new Error((err as { message?: string }).message);
      }
      return resp.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation'] }),
  });

  const repairMutation = useMutation({
    mutationFn: async ({ rowId, note }: { rowId: string; note: string }) => {
      const resp = await fetch(`${SERVICE_BASE}/api/payments/reconciliation/repair`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: rowId, note }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Repair failed' }));
        throw new Error((err as { message?: string }).message);
      }
      return resp.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reconciliation'] }); setRepairTarget(null); setRepairNote(''); },
  });

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>WeChat Pay Reconciliation</h2>

      <div style={styles.toolbar}>
        <label style={styles.uploadBtn}>
          Import CSV
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importMutation.mutate(f); }}
          />
        </label>
        {importMutation.isPending && <span style={styles.hint}>Importing…</span>}
        {importMutation.isError && <span style={styles.error}>{importMutation.error.message}</span>}
      </div>

      {isLoading ? (
        <div style={styles.hint}>Loading…</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>{['Payment Intent ID', 'Amount', 'Status', 'Imported', 'Actions'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row._id}>
                <td style={styles.td}>{row.paymentIntentId}</td>
                <td style={styles.td}>{row.currency} {row.amount.toFixed(2)}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, ...statusStyle(row.status) }}>{row.status}</span>
                </td>
                <td style={styles.td}>{new Date(row.importedAt).toLocaleDateString()}</td>
                <td style={styles.td}>
                  {row.status === 'exception' && (
                    <button onClick={() => setRepairTarget(row.paymentIntentId)} style={styles.repairBtn}>Repair</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {repairTarget && (
        <div style={styles.repairPanel}>
          <p style={styles.repairLabel}>Repair exception — provide a note (required):</p>
          <textarea
            value={repairNote}
            onChange={(e) => setRepairNote(e.target.value)}
            rows={3}
            style={styles.textarea}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => repairMutation.mutate({ rowId: repairTarget, note: repairNote })}
              disabled={!repairNote.trim() || repairMutation.isPending}
              style={{ ...styles.btn, opacity: !repairNote.trim() ? 0.4 : 1 }}
            >
              Submit Repair
            </button>
            <button onClick={() => setRepairTarget(null)} style={{ ...styles.btn, background: '#334155' }}>Cancel</button>
          </div>
          {repairMutation.isError && <p style={styles.error}>{repairMutation.error.message}</p>}
        </div>
      )}
    </div>
  );
}

function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, string> = { matched: '#166534', unmatched: '#92400e', duplicate: '#1d4ed8', exception: '#7f1d1d' };
  return { background: map[status] ?? '#334155' };
}

const styles = {
  page: { padding: '1.5rem', background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: 18, margin: '0 0 1rem', color: '#f1f5f9' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  uploadBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { color: '#64748b', padding: '0.5rem 0.75rem', textAlign: 'left' as const, borderBottom: '1px solid #1e293b' },
  td: { color: '#e2e8f0', padding: '0.6rem 0.75rem', borderBottom: '1px solid #1e293b' },
  badge: { padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: 11, color: '#fff', fontWeight: 600 },
  repairBtn: { background: '#78350f', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: 12, cursor: 'pointer' },
  repairPanel: { marginTop: 16, background: '#1e293b', borderRadius: 8, padding: '1rem', border: '1px solid #334155' },
  repairLabel: { color: '#94a3b8', fontSize: 13, margin: '0 0 8px' },
  textarea: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#f1f5f9', padding: '0.5rem', fontSize: 13, resize: 'vertical' as const, boxSizing: 'border-box' as const },
  btn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  hint: { color: '#94a3b8', fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
} as const;
