import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/useAuth.js';
import type { OrderState } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

interface ApiOrder {
  _id: string;
  orderNumber: string;
  userId: string;
  state: OrderState;
  total: number;
  currency: string;
  itemCount: number;
  submittedAt?: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/approvals/pending`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load approvals');
      const body = await resp.json() as { data: ApiOrder[] };
      return body.data;
    },
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: string; action: 'approve' | 'reject' }) => {
      const resp = await fetch(`${SERVICE_BASE}/api/approvals/${orderId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!resp.ok) throw new Error(`${action} failed`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });

  if (isLoading) return <div style={styles.msg}>Loading…</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Pending Approvals</h2>
      {(!data || data.length === 0) ? (
        <p style={styles.empty}>No orders awaiting approval.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>{['Order #', 'Student', 'Items', 'Total', 'Submitted', 'Actions'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {data.map((order) => (
              <tr key={order._id}>
                <td style={styles.td}>{order.orderNumber}</td>
                <td style={styles.td}>{order.userId}</td>
                <td style={styles.td}>{order.itemCount ?? 0}</td>
                <td style={styles.td}>{order.currency} {order.total.toFixed(2)}</td>
                <td style={styles.td}>{new Date(order.submittedAt ?? order.createdAt).toLocaleDateString()}</td>
                <td style={styles.td}>
                  <button
                    onClick={() => approveMutation.mutate({ orderId: order._id, action: 'approve' })}
                    style={{ ...styles.btn, background: '#166534' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ orderId: order._id, action: 'reject' })}
                    style={{ ...styles.btn, background: '#7f1d1d', marginLeft: 6 }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem' },
  heading: { color: '#f1f5f9', margin: '0 0 1rem', fontSize: 20 },
  empty: { color: '#64748b', fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { color: '#64748b', padding: '0.5rem 0.75rem', textAlign: 'left' as const, borderBottom: '1px solid #1e293b' },
  td: { color: '#e2e8f0', padding: '0.6rem 0.75rem', borderBottom: '1px solid #1e293b' },
  btn: { color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 0.7rem', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  msg: { color: '#94a3b8', padding: 24 },
} as const;
