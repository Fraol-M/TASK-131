import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OrderState, OrderNote } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

// API-specific item shape — backend returns skuMasked instead of raw sku
interface ApiOrderItem {
  _id: string;
  name: string;
  skuMasked: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

// API response — service embeds items + notes in GET /api/orders/:id
interface ApiOrderDetail {
  _id: string;
  orderNumber: string;
  userId: string;
  state: OrderState;
  subtotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  items: ApiOrderItem[];
  notes: OrderNote[];
  createdAt: string;
  approvedAt?: string;
  paidAt?: string;
}

// This component renders in a dedicated Electron window.
// The orderId is passed via URL hash: #/order-detail?id=<orderId>
function getOrderIdFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  return params.get('id');
}

export default function OrderDetailWindow() {
  const orderId = getOrderIdFromHash();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/orders/${orderId}`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load order');
      const body = await resp.json() as { data: ApiOrderDetail };
      return body.data;
    },
    enabled: !!orderId,
  });

  if (!orderId) return <div style={styles.msg}>No order ID provided</div>;
  if (isLoading) return <div style={styles.msg}>Loading…</div>;
  if (error) return <div style={styles.error}>Failed to load order</div>;
  if (!order) return <div style={styles.msg}>Order not found</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Order {order.orderNumber}</h2>
      <div style={styles.meta}>
        <Row label="Status" value={<span style={{ color: '#60a5fa' }}>{order.state}</span>} />
        <Row label="Customer" value={order.userId} />
        <Row label="Created" value={new Date(order.createdAt).toLocaleString()} />
        {order.approvedAt && <Row label="Approved" value={new Date(order.approvedAt).toLocaleString()} />}
        {order.paidAt && <Row label="Paid" value={new Date(order.paidAt).toLocaleString()} />}
      </div>

      <h3 style={styles.subheading}>Items</h3>
      <table style={styles.table}>
        <thead>
          <tr>{['Name', 'SKU', 'Qty', 'Unit Price', 'Line Total'].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item._id}>
              <td style={styles.td}>{item.name}</td>
              <td style={styles.td}>{item.skuMasked}</td>
              <td style={styles.td}>{item.quantity}</td>
              <td style={styles.td}>{order.currency} {item.unitPrice.toFixed(2)}</td>
              <td style={styles.td}>{order.currency} {item.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={styles.totals}>
        <div>Subtotal: {order.currency} {order.subtotal.toFixed(2)}</div>
        <div>Tax: {order.currency} {order.taxTotal.toFixed(2)}</div>
        <div style={{ fontWeight: 700, color: '#f1f5f9' }}>Total: {order.currency} {order.total.toFixed(2)}</div>
      </div>

      {order.notes && order.notes.length > 0 && (
        <>
          <h3 style={styles.subheading}>Notes</h3>
          {order.notes.map((note) => (
            <div key={note._id} style={styles.note}>{note.content}</div>
          ))}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#94a3b8' }}>
      <span style={{ minWidth: 80 }}>{label}:</span>
      <span style={{ color: '#e2e8f0' }}>{value}</span>
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: 18, margin: '0 0 1rem', color: '#f1f5f9' },
  meta: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 24 },
  subheading: { fontSize: 14, color: '#94a3b8', margin: '1.5rem 0 0.75rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { color: '#64748b', padding: '0.4rem 0.75rem', textAlign: 'left' as const, borderBottom: '1px solid #1e293b' },
  td: { color: '#e2e8f0', padding: '0.5rem 0.75rem', borderBottom: '1px solid #1e293b' },
  totals: { textAlign: 'right' as const, marginTop: 12, display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 4, color: '#94a3b8', fontSize: 13 },
  note: { background: '#1e293b', borderRadius: 6, padding: '0.6rem', fontSize: 13, color: '#cbd5e1', marginBottom: 6 },
  msg: { color: '#94a3b8', padding: 24 },
  error: { color: '#f87171', padding: 24 },
} as const;
