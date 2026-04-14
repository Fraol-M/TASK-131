import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../auth/useAuth.js';
import { ConflictPanel } from './ConflictPanel.js';
import { SimulationRunner } from './SimulationRunner.js';
import { VisualRuleEditor } from './VisualRuleEditor.js';
import type { Rule } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

type Tab = 'rules' | 'conflicts' | 'simulation';

export default function RulesPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('rules');
  const [editorRule, setEditorRule] = useState<Rule | null | undefined>(undefined);
  // undefined = editor closed, null = creating new, Rule = editing existing

  const { data: rules, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const resp = await fetch(`${SERVICE_BASE}/api/rules`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to load rules');
      const body = await resp.json() as { data: Rule[] };
      return body.data;
    },
    enabled: !!user,
  });

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Rules Engine</h2>
        {tab === 'rules' && (
          <button onClick={() => setEditorRule(null)} style={styles.createBtn}>
            + New Rule
          </button>
        )}
      </div>

      <div style={styles.tabs}>
        {(['rules', 'conflicts', 'simulation'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        isLoading ? <div style={styles.msg}>Loading…</div> : (
          <table style={styles.table}>
            <thead>
              <tr>{['Name', 'Priority', 'Scope', 'Status', 'Conditions', 'Actions', ''].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(rules ?? []).map((rule) => (
                <tr key={rule._id}>
                  <td style={styles.td}>{rule.name}</td>
                  <td style={styles.td}>{rule.priority}</td>
                  <td style={styles.td}>
                    <span style={styles.scopeChip}>
                      {Object.entries(rule.scope)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k}:${v as string}`)
                        .join(', ') || 'global'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: rule.status === 'active' ? '#34d399' : '#64748b' }}>
                      {rule.status}
                    </span>
                  </td>
                  <td style={styles.td}>{rule.conditions.conditions.length}</td>
                  <td style={styles.td}>{rule.actions.length}</td>
                  <td style={styles.td}>
                    <button
                      onClick={() => setEditorRule(rule)}
                      style={styles.editBtn}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'conflicts' && <ConflictPanel />}
      {tab === 'simulation' && <SimulationRunner />}

      {editorRule !== undefined && (
        <VisualRuleEditor
          rule={editorRule ?? undefined}
          onClose={() => setEditorRule(undefined)}
        />
      )}
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', flex: 1, overflow: 'auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  heading: { color: '#f1f5f9', margin: 0, fontSize: 20 },
  createBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '0.4rem 1rem', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  tabs: { display: 'flex', gap: 4, marginBottom: 16 },
  tab: {
    background: 'transparent', border: '1px solid #334155', color: '#64748b',
    borderRadius: 4, padding: '0.4rem 0.85rem', fontSize: 13, cursor: 'pointer',
  },
  tabActive: { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { color: '#64748b', padding: '0.5rem 0.75rem', textAlign: 'left' as const, borderBottom: '1px solid #1e293b' },
  td: { color: '#e2e8f0', padding: '0.6rem 0.75rem', borderBottom: '1px solid #1e293b' },
  scopeChip: { color: '#94a3b8', fontSize: 11 },
  editBtn: { background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 3, padding: '0.25rem 0.6rem', fontSize: 12, cursor: 'pointer' },
  msg: { color: '#94a3b8', padding: 24 },
} as const;
