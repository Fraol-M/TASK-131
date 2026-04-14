import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { RuleSimulation } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

export function SimulationRunner() {
  const [ruleId, setRuleId] = useState('');
  const [result, setResult] = useState<RuleSimulation | null>(null);

  const simulate = useMutation({
    mutationFn: async () => {
      if (!ruleId.trim()) throw new Error('Rule ID is required to run a simulation');

      // Fetch recent order IDs to use as the historical sample
      const ordersResp = await fetch(`${SERVICE_BASE}/api/orders`, { credentials: 'include' });
      if (!ordersResp.ok) throw new Error('Failed to load orders for simulation');
      const ordersBody = await ordersResp.json() as { data: Array<{ _id: string }> };
      const historicalOrderIds = (ordersBody.data ?? []).map((o) => o._id).slice(0, 50);

      if (historicalOrderIds.length === 0) {
        throw new Error('No orders found — create some orders first to run a simulation');
      }

      const resp = await fetch(`${SERVICE_BASE}/api/rules/simulations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: ruleId.trim(), historicalOrderIds }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Simulation failed' }));
        throw new Error((err as { message?: string }).message ?? 'Simulation failed');
      }
      const body = await resp.json() as { data: RuleSimulation };
      return body.data;
    },
    onSuccess: (data) => setResult(data),
  });

  return (
    <div>
      <div style={styles.controls}>
        <input
          value={ruleId}
          onChange={(e) => setRuleId(e.target.value)}
          placeholder="Rule ID (required)"
          style={styles.input}
        />
        <button
          onClick={() => simulate.mutate()}
          disabled={simulate.isPending || !ruleId.trim()}
          style={{ ...styles.btn, opacity: simulate.isPending || !ruleId.trim() ? 0.6 : 1 }}
        >
          {simulate.isPending ? 'Running…' : 'Run Simulation'}
        </button>
      </div>

      {simulate.isError && <p style={styles.error}>{simulate.error.message}</p>}

      {result && (
        <div style={styles.resultBox}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Orders tested</span>
            <span style={styles.statValue}>{result.totalOrders}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Orders matched</span>
            <span style={{ ...styles.statValue, color: result.matchedCount > 0 ? '#34d399' : '#94a3b8' }}>
              {result.matchedCount}
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Match rate</span>
            <span style={styles.statValue}>
              {result.totalOrders > 0
                ? `${((result.matchedCount / result.totalOrders) * 100).toFixed(1)}%`
                : '—'}
            </span>
          </div>
          {result.matchedOrderIds.length > 0 && (
            <div style={styles.matchedIds}>
              <div style={styles.matchedLabel}>Matched order IDs:</div>
              {result.matchedOrderIds.map((id) => (
                <div key={id} style={styles.orderId}>{id.slice(-12)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  controls: { display: 'flex', gap: 10, marginBottom: 12 },
  input: {
    flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
    color: '#f1f5f9', padding: '0.5rem 0.75rem', fontSize: 13, outline: 'none',
  },
  btn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' as const },
  error: { color: '#f87171', fontSize: 13 },
  resultBox: { background: '#1e293b', borderRadius: 8, padding: '1rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column' as const, gap: 8 },
  stat: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
  statLabel: { color: '#64748b' },
  statValue: { color: '#f1f5f9', fontWeight: 600 },
  matchedIds: { marginTop: 8, borderTop: '1px solid #334155', paddingTop: 8 },
  matchedLabel: { color: '#64748b', fontSize: 11, marginBottom: 4 },
  orderId: { color: '#93c5fd', fontSize: 12, fontFamily: 'monospace' },
} as const;
