import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../auth/useAuth.js';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

interface AuditEvent {
  _id: string;
  action: string;
  userId?: string;
  targetType?: string;
  targetId?: string;
  occurredAt: string;
  meta?: Record<string, unknown>;
}

interface AuditMeta {
  page: number;
  pageSize: number;
  total: number;
}

export default function AuditViewerPage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const pageSize = 50;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-events', page, filterAction, filterUserId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filterAction) params.set('action', filterAction);
      if (filterUserId) params.set('userId', filterUserId);

      const resp = await fetch(`${SERVICE_BASE}/api/audits?${params}`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load audit events');
      return resp.json() as Promise<{ data: AuditEvent[]; meta: AuditMeta }>;
    },
    enabled: !!user,
  });

  const events = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Audit Log</h2>

      <div style={styles.filters}>
        <input
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          placeholder="Filter by action…"
          style={styles.filterInput}
        />
        <input
          value={filterUserId}
          onChange={(e) => { setFilterUserId(e.target.value); setPage(1); }}
          placeholder="Filter by user ID…"
          style={styles.filterInput}
        />
      </div>

      {isLoading && <div style={styles.msg}>Loading…</div>}
      {isError && <div style={styles.error}>Failed to load audit events.</div>}

      {!isLoading && !isError && (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Occurred At', 'Action', 'User ID', 'Target Type', 'Target ID', 'Meta'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...styles.td, color: '#64748b', textAlign: 'center' }}>No events found.</td></tr>
                ) : events.map((event) => (
                  <tr key={event._id} style={styles.row}>
                    <td style={styles.td}>{new Date(event.occurredAt).toLocaleString()}</td>
                    <td style={styles.td}><span style={styles.action}>{event.action}</span></td>
                    <td style={styles.td}>{event.userId ?? '—'}</td>
                    <td style={styles.td}>{event.targetType ?? '—'}</td>
                    <td style={styles.td}>{event.targetId ?? '—'}</td>
                    <td style={styles.td}>
                      {event.meta ? (
                        <span style={styles.meta}>{JSON.stringify(event.meta)}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.total > pageSize && (
            <div style={styles.pagination}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
              >
                ‹ Prev
              </button>
              <span style={styles.pageInfo}>Page {page} of {totalPages} ({meta.total} total)</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ ...styles.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', overflow: 'auto', height: '100%' },
  heading: { color: '#f1f5f9', margin: '0 0 1rem', fontSize: 20 },
  filters: { display: 'flex', gap: 10, marginBottom: '1rem' },
  filterInput: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', padding: '0.4rem 0.75rem', fontSize: 13, outline: 'none', width: 220,
  },
  tableWrap: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: {
    color: '#64748b', padding: '0.5rem 0.75rem', textAlign: 'left' as const,
    borderBottom: '2px solid #1e293b', whiteSpace: 'nowrap' as const,
  },
  row: {},
  td: { color: '#e2e8f0', padding: '0.5rem 0.75rem', borderBottom: '1px solid #0f172a', verticalAlign: 'top' as const },
  action: {
    background: '#0f172a', border: '1px solid #1e293b', borderRadius: 4,
    padding: '0.1rem 0.4rem', fontFamily: 'monospace', fontSize: 11, color: '#7dd3fc',
  },
  meta: { fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', wordBreak: 'break-all' as const },
  pagination: { display: 'flex', alignItems: 'center', gap: 12, marginTop: '1rem' },
  pageBtn: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', padding: '0.35rem 0.75rem', fontSize: 12, cursor: 'pointer',
  },
  pageInfo: { color: '#64748b', fontSize: 12 },
  msg: { color: '#94a3b8', padding: 24 },
  error: { color: '#f87171', padding: 24 },
} as const;
