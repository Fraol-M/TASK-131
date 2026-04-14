import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/useAuth.js';
import { OrderContextMenu } from '../../components/OrderContextMenu.js';
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
  createdAt: string;
}

interface ContextMenu { orderId: string; x: number; y: number }
type ActiveAction = 'split' | 'merge' | 'rma' | 'tag-note' | null;

export default function OrdersPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [ctx, setCtx] = useState<ContextMenu | null>(null);
  const [action, setAction] = useState<ActiveAction>(null);
  const [actionOrderId, setActionOrderId] = useState<string>('');

  // Action form state
  const [splitItemIds, setSplitItemIds] = useState('');
  const [mergeOrderIds, setMergeOrderIds] = useState('');
  const [rmaReason, setRmaReason] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [tagContent, setTagContent] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/orders`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load orders');
      const body = await resp.json() as { data: ApiOrder[] };
      return body.data;
    },
    enabled: !!user,
  });

  const openDetail = async (orderId: string) => {
    await (window as unknown as { nexusorder: { invoke: (c: string, id: string) => Promise<void> } })
      .nexusorder.invoke('window:open-order-detail', orderId);
  };

  const handleContextMenu = (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    setCtx({ orderId, x: e.clientX, y: e.clientY });
  };

  const openAction = (orderId: string, act: ActiveAction) => {
    setActionOrderId(orderId);
    setAction(act);
    setSplitItemIds('');
    setMergeOrderIds(orderId);
    setRmaReason('');
    setNoteContent('');
    setTagContent('');
  };

  const splitMutation = useMutation({
    mutationFn: async () => {
      const itemIds = splitItemIds.split(',').map((s) => s.trim()).filter(Boolean);
      const resp = await fetch(`${SERVICE_BASE}/api/rma/orders/${actionOrderId}/split`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? 'Split failed'); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setAction(null); },
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const orderIds = mergeOrderIds.split(',').map((s) => s.trim()).filter(Boolean);
      const resp = await fetch(`${SERVICE_BASE}/api/rma/orders/merge`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? 'Merge failed'); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setAction(null); },
  });

  const rmaMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/rma/orders/${actionOrderId}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: 'OTHER', reason: rmaReason }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? 'RMA failed'); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setAction(null); },
  });

  const tagNoteMutation = useMutation({
    mutationFn: async () => {
      const requests: Promise<Response>[] = [];
      if (noteContent.trim()) {
        requests.push(fetch(`${SERVICE_BASE}/api/orders/${actionOrderId}/notes`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: noteContent }),
        }));
      }
      if (tagContent.trim()) {
        requests.push(fetch(`${SERVICE_BASE}/api/orders/${actionOrderId}/tags`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: tagContent }),
        }));
      }
      await Promise.all(requests);
    },
    onSuccess: () => { setAction(null); },
  });

  const isPending = splitMutation.isPending || mergeMutation.isPending || rmaMutation.isPending || tagNoteMutation.isPending;
  const mutError = splitMutation.error?.message ?? mergeMutation.error?.message ?? rmaMutation.error?.message ?? tagNoteMutation.error?.message;

  if (isLoading) return <div style={styles.msg}>Loading orders…</div>;
  if (error) return <div style={styles.error}>Failed to load orders</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Orders</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Order #', 'Status', 'Items', 'Total', 'Created'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((order) => (
            <tr
              key={order._id}
              onDoubleClick={() => openDetail(order._id)}
              onContextMenu={(e) => handleContextMenu(e, order._id)}
              style={styles.tr}
            >
              <td style={styles.td}>{order.orderNumber}</td>
              <td style={styles.td}>
                <span style={{ ...styles.badge, ...statusColor(order.state) }}>
                  {order.state}
                </span>
              </td>
              <td style={styles.td}>{order.itemCount ?? 0}</td>
              <td style={styles.td}>{order.currency} {(order.total ?? 0).toFixed(2)}</td>
              <td style={styles.td}>{new Date(order.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {ctx && (
        <OrderContextMenu
          orderId={ctx.orderId}
          x={ctx.x}
          y={ctx.y}
          onClose={() => setCtx(null)}
          onSplit={(id) => { setCtx(null); openAction(id, 'split'); }}
          onMerge={(id) => { setCtx(null); openAction(id, 'merge'); }}
          onCreateRma={(id) => { setCtx(null); openAction(id, 'rma'); }}
          onTagNote={(id) => { setCtx(null); openAction(id, 'tag-note'); }}
        />
      )}

      {action && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            {action === 'split' && (
              <>
                <h3 style={styles.modalTitle}>Split Order</h3>
                <p style={styles.modalDesc}>Enter comma-separated item IDs to move to the new child order.</p>
                <textarea
                  value={splitItemIds}
                  onChange={(e) => setSplitItemIds(e.target.value)}
                  placeholder="item-id-1, item-id-2"
                  style={styles.textarea}
                />
                {mutError && <p style={styles.mutError}>{mutError}</p>}
                <div style={styles.modalActions}>
                  <button onClick={() => splitMutation.mutate()} disabled={isPending} style={styles.confirmBtn}>
                    {isPending ? 'Splitting…' : 'Split'}
                  </button>
                  <button onClick={() => setAction(null)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </>
            )}

            {action === 'merge' && (
              <>
                <h3 style={styles.modalTitle}>Merge Orders</h3>
                <p style={styles.modalDesc}>Enter comma-separated order IDs to merge (include this order's ID).</p>
                <textarea
                  value={mergeOrderIds}
                  onChange={(e) => setMergeOrderIds(e.target.value)}
                  placeholder="order-id-1, order-id-2"
                  style={styles.textarea}
                />
                {mutError && <p style={styles.mutError}>{mutError}</p>}
                <div style={styles.modalActions}>
                  <button onClick={() => mergeMutation.mutate()} disabled={isPending} style={styles.confirmBtn}>
                    {isPending ? 'Merging…' : 'Merge'}
                  </button>
                  <button onClick={() => setAction(null)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </>
            )}

            {action === 'rma' && (
              <>
                <h3 style={styles.modalTitle}>Create RMA</h3>
                <textarea
                  value={rmaReason}
                  onChange={(e) => setRmaReason(e.target.value)}
                  placeholder="Reason for return / exchange…"
                  style={styles.textarea}
                />
                {mutError && <p style={styles.mutError}>{mutError}</p>}
                <div style={styles.modalActions}>
                  <button onClick={() => rmaMutation.mutate()} disabled={isPending || !rmaReason.trim()} style={styles.confirmBtn}>
                    {isPending ? 'Submitting…' : 'Create RMA'}
                  </button>
                  <button onClick={() => setAction(null)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </>
            )}

            {action === 'tag-note' && (
              <>
                <h3 style={styles.modalTitle}>Tag / Note</h3>
                <label style={styles.fieldLabel}>
                  Tag
                  <input
                    value={tagContent}
                    onChange={(e) => setTagContent(e.target.value)}
                    placeholder="e.g. urgent"
                    style={styles.input}
                  />
                </label>
                <label style={styles.fieldLabel}>
                  Note
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Add a note…"
                    style={styles.textarea}
                  />
                </label>
                {mutError && <p style={styles.mutError}>{mutError}</p>}
                <div style={styles.modalActions}>
                  <button
                    onClick={() => tagNoteMutation.mutate()}
                    disabled={isPending || (!tagContent.trim() && !noteContent.trim())}
                    style={styles.confirmBtn}
                  >
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setAction(null)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function statusColor(state: string): React.CSSProperties {
  const map: Record<string, string> = {
    draft: '#475569', submitted: '#1d4ed8', approved: '#166534',
    paid: '#065f46', allocated: '#92400e', shipped: '#78350f',
    delivered: '#14532d', closed: '#374151', cancelled: '#7f1d1d',
  };
  return { background: map[state] ?? '#475569' };
}

const styles = {
  page: { padding: '1.5rem', flex: 1, overflow: 'auto' },
  heading: { color: '#f1f5f9', margin: '0 0 1rem', fontSize: 20 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { color: '#64748b', padding: '0.5rem 0.75rem', textAlign: 'left' as const, borderBottom: '1px solid #1e293b' },
  tr: { cursor: 'pointer' },
  td: { color: '#e2e8f0', padding: '0.6rem 0.75rem', borderBottom: '1px solid #1e293b' },
  badge: { padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: 11, color: '#fff', fontWeight: 600 },
  msg: { color: '#94a3b8', padding: 24 },
  error: { color: '#f87171', padding: 24 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '1.5rem', width: 460, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  modalTitle: { color: '#f1f5f9', fontSize: 16, margin: 0 },
  modalDesc: { color: '#94a3b8', fontSize: 12, margin: 0 },
  textarea: { background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#f1f5f9', padding: '0.5rem', fontSize: 13, minHeight: 80, resize: 'vertical' as const, outline: 'none' },
  input: { background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#f1f5f9', padding: '0.5rem', fontSize: 13, outline: 'none' },
  fieldLabel: { display: 'flex', flexDirection: 'column' as const, gap: 4, color: '#94a3b8', fontSize: 12 },
  modalActions: { display: 'flex', gap: 8 },
  confirmBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1.25rem', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  cancelBtn: { background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: 4, padding: '0.5rem 1.25rem', fontSize: 13, cursor: 'pointer' },
  mutError: { color: '#f87171', fontSize: 12, margin: 0 },
} as const;
