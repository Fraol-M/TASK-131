import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

interface SearchResult {
  type: 'order' | 'catalog_item' | 'user';
  id: string;
  label: string;
  sub: string;
}

interface Props {
  onClose: () => void;
}

export function GlobalSearchModal({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }

    const controller = new AbortController();
    setLoading(true);

    fetch(`${SERVICE_BASE}/api/search?q=${encodeURIComponent(query)}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((body: { data: { orders?: Record<string,unknown>[]; rules?: Record<string,unknown>[]; users?: Record<string,unknown>[] } }) => {
        const flat: SearchResult[] = [];
        for (const o of body.data.orders ?? []) {
          flat.push({ type: 'order', id: String(o['_id']), label: String(o['orderNumber'] ?? o['_id']), sub: String(o['state'] ?? '') });
        }
        for (const r of body.data.rules ?? []) {
          flat.push({ type: 'catalog_item', id: String(r['_id']), label: String(r['name'] ?? r['_id']), sub: 'rule' });
        }
        for (const u of body.data.users ?? []) {
          flat.push({ type: 'user', id: String(u['_id']), label: String(u['username'] ?? u['_id']), sub: String(u['role'] ?? '') });
        }
        setResults(flat);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => controller.abort();
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    onClose();
    if (result.type === 'order') navigate(`/orders?highlight=${result.id}`);
    else if (result.type === 'catalog_item') navigate(`/catalog?highlight=${result.id}`);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search orders, items, users…"
          style={styles.input}
        />
        {loading && <div style={styles.hint}>Searching…</div>}
        {results.length > 0 && (
          <div style={styles.results}>
            {results.map((r) => (
              <button key={r.id} onClick={() => handleSelect(r)} style={styles.resultItem}>
                <span style={styles.resultType}>{r.type.replace('_', ' ')}</span>
                <span style={styles.resultLabel}>{r.label}</span>
                <span style={styles.resultSub}>{r.sub}</span>
              </button>
            ))}
          </div>
        )}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div style={styles.hint}>No results</div>
        )}
        <div style={styles.footer}>Esc to close</div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '10vh', zIndex: 999,
  },
  modal: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
    width: 560, boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  input: {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    color: '#f1f5f9', fontSize: 16, padding: '1rem 1.25rem', boxSizing: 'border-box' as const,
  },
  results: { borderTop: '1px solid #334155', maxHeight: 320, overflow: 'auto' },
  resultItem: {
    display: 'flex', width: '100%', alignItems: 'center', gap: 10,
    background: 'transparent', border: 'none', padding: '0.7rem 1.25rem',
    cursor: 'pointer', textAlign: 'left' as const, borderBottom: '1px solid #0f172a',
  },
  resultType: { fontSize: 10, color: '#475569', width: 80, flexShrink: 0, textTransform: 'uppercase' as const },
  resultLabel: { fontSize: 13, color: '#e2e8f0', flex: 1 },
  resultSub: { fontSize: 11, color: '#64748b' },
  hint: { padding: '0.75rem 1.25rem', color: '#64748b', fontSize: 13 },
  footer: { borderTop: '1px solid #1e293b', padding: '0.5rem 1.25rem', fontSize: 11, color: '#475569' },
} as const;
