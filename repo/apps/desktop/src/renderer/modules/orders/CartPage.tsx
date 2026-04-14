import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/useAuth.js';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

// API response: cart with enriched items (name + unitPrice joined from catalog)
interface ApiCartItem {
  _id: string;
  catalogItemId: string;
  name: string;
  skuMasked: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface ApiCart {
  _id: string;
  userId: string;
  items: ApiCartItem[];
  subtotal: number;
  currency: string;
}

export default function CartPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/carts/active`, { credentials: 'include' });
      if (!resp.ok) return null;
      const body = await resp.json() as { data: ApiCart };
      return body.data;
    },
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/carts/checkout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Checkout failed' }));
        throw new Error((err as { message?: string }).message);
      }
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Listen for Ctrl+Enter shortcut
  useEffect(() => {
    const handler = () => { if (!checkoutMutation.isPending) checkoutMutation.mutate(); };
    document.addEventListener('nexus:checkout:submit', handler);
    return () => document.removeEventListener('nexus:checkout:submit', handler);
  }, [checkoutMutation]);

  if (isLoading) return <div style={styles.msg}>Loading cart…</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Cart</h2>

      {!cart || cart.items.length === 0 ? (
        <p style={styles.empty}>Your cart is empty. Browse the catalog to add items.</p>
      ) : (
        <>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Item', 'SKU', 'Qty', 'Unit Price', 'Line Total'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cart.items.map((item) => (
                <tr key={item._id}>
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.skuMasked}</td>
                  <td style={styles.td}>{item.quantity}</td>
                  <td style={styles.td}>{cart.currency} {item.unitPrice.toFixed(2)}</td>
                  <td style={styles.td}>{cart.currency} {item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={styles.footer}>
            <div style={styles.total}>
              Subtotal: {cart.currency} {cart.subtotal.toFixed(2)}
            </div>
            <button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              style={{ ...styles.btn, opacity: checkoutMutation.isPending ? 0.6 : 1 }}
            >
              {checkoutMutation.isPending ? 'Submitting…' : 'Checkout (Ctrl+Enter)'}
            </button>
          </div>

          {checkoutMutation.isError && (
            <p style={styles.error}>{checkoutMutation.error.message}</p>
          )}
        </>
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
  footer: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 16 },
  total: { color: '#f1f5f9', fontWeight: 600, fontSize: 15 },
  btn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '0.6rem 1.2rem', fontSize: 14, cursor: 'pointer', fontWeight: 600 },
  error: { color: '#f87171', fontSize: 13 },
  msg: { color: '#94a3b8', padding: 24 },
} as const;
