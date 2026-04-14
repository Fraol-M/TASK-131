import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/useAuth.js';
import { ProductCard } from './ProductCard.js';
import type { CatalogItem } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

export default function CatalogPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['catalog', user?.scope],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/catalog`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load catalog');
      const body = await resp.json() as { data: CatalogItem[] };
      return body.data;
    },
    enabled: !!user,
  });

  const addToCartMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const resp = await fetch(`${SERVICE_BASE}/api/carts/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogItemId: itemId, quantity: 1, currency: 'CNY' }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Failed to add' }));
        throw new Error((err as { message?: string }).message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });

  const filtered = (data ?? []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Catalog</h2>
        <div style={styles.searchRow}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items… (Ctrl+K for global)"
            style={styles.input}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={styles.msg}>Loading catalog…</div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((item) => (
            <ProductCard
              key={item._id}
              item={item}
              onAddToCart={() => addToCartMutation.mutate(item._id)}
            />
          ))}
          {filtered.length === 0 && <div style={styles.empty}>No items found</div>}
        </div>
      )}

    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', flex: 1, overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  heading: { color: '#f1f5f9', margin: 0, fontSize: 20 },
  searchRow: {},
  input: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
    color: '#f1f5f9', padding: '0.5rem 0.75rem', fontSize: 13, width: 280, outline: 'none',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  empty: { color: '#64748b', fontSize: 14, gridColumn: '1/-1' },
  msg: { color: '#94a3b8', padding: 24 },
} as const;
