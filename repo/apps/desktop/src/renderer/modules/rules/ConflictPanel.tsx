import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RuleConflict } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

export function ConflictPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['rule-conflicts'],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/rules/conflicts`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load conflicts');
      const body = await resp.json() as { data: RuleConflict[] };
      return body.data;
    },
  });

  if (isLoading) return <div style={styles.msg}>Analyzing conflicts…</div>;

  return (
    <div>
      {(!data || data.length === 0) ? (
        <div style={styles.ok}>No conflicts detected</div>
      ) : (
        data.map((conflict) => (
          <div key={`${conflict.ruleIds[0]}-${conflict.ruleIds[1]}`} style={styles.card}>
            <div style={styles.type}>{conflict.conflictType.replace('_', ' ')}</div>
            <div style={styles.desc}>{conflict.description}</div>
            {conflict.remediationSuggestions.length > 0 && (
              <div style={styles.suggestions}>
                <span style={styles.sugLabel}>Suggestions:</span>
                {conflict.remediationSuggestions.map((s, i) => (
                  <div key={i} style={styles.sug}>• {s.type.replace(/_/g, ' ')}: {s.description}</div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  msg: { color: '#94a3b8', padding: 24 },
  ok: { color: '#34d399', padding: 16, fontSize: 14 },
  card: {
    background: '#1e293b', borderRadius: 8, padding: '1rem',
    border: '1px solid #7f1d1d', marginBottom: 12,
  },
  type: { color: '#f87171', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' as const, marginBottom: 4 },
  desc: { color: '#e2e8f0', fontSize: 13 },
  suggestions: { marginTop: 8 },
  sugLabel: { color: '#64748b', fontSize: 11 },
  sug: { color: '#93c5fd', fontSize: 12, marginTop: 4 },
} as const;
