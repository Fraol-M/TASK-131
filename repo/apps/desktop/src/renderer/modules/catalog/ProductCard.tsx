import React from 'react';
import { maskField } from '@nexusorder/shared-logging';
import type { CatalogItem } from '@nexusorder/shared-types';

interface Props {
  item: CatalogItem;
  onAddToCart: () => void;
}

export function ProductCard({ item, onAddToCart }: Props) {
  // SKU is masked to last 4 chars — display only
  const skuMasked = item.sku ? maskField(item.sku) : null;

  return (
    <div style={styles.card}>
      <div style={styles.name}>{item.name}</div>
      {item.description && <div style={styles.desc}>{item.description}</div>}
      <div style={styles.meta}>
        <span style={styles.price}>${item.unitPrice.toFixed(2)}</span>
        {skuMasked && <span style={styles.code}>SKU: …{skuMasked}</span>}
      </div>
      {!item.isAvailable ? (
        <div style={styles.unavailable}>Unavailable for ordering</div>
      ) : (
        <button onClick={onAddToCart} style={styles.btn}>Add to Cart</button>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#1e293b', borderRadius: 8, padding: '1rem',
    border: '1px solid #334155', display: 'flex', flexDirection: 'column' as const, gap: 8,
  },
  name: { color: '#f1f5f9', fontWeight: 600, fontSize: 14 },
  desc: { color: '#64748b', fontSize: 12, lineHeight: 1.4 },
  meta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  price: { color: '#34d399', fontWeight: 700, fontSize: 16 },
  code: { color: '#475569', fontSize: 11, fontFamily: 'monospace' },
  unavailable: { color: '#f87171', fontSize: 12, fontStyle: 'italic' },
  btn: {
    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.4rem 0.75rem', fontSize: 12, cursor: 'pointer', fontWeight: 600,
  },
} as const;
