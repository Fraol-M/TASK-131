import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Rule, Condition, ConditionGroup, ConditionOperator, RuleAction, TimeWindow, UserScope } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq', label: '= equals' },
  { value: 'neq', label: '≠ not equals' },
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '≥ greater or equal' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '≤ less or equal' },
  { value: 'in', label: 'in (comma-separated)' },
  { value: 'not_in', label: 'not in (comma-separated)' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'is_null', label: 'is null' },
  { value: 'is_not_null', label: 'is not null' },
];

interface Props {
  rule?: Rule;
  onClose: () => void;
}

interface DraftCondition {
  field: string;
  operator: ConditionOperator;
  value: string; // always string in editor; parsed to correct type in buildPayload
}

interface DraftRule {
  name: string;
  priority: number;
  scope: UserScope;
  conditionLogic: 'and' | 'or';
  conditionRows: DraftCondition[];
  actions: RuleAction[];
  timeWindow: { enabled: boolean; startDate: string; endDate: string; startTime: string; endTime: string; daysOfWeek: number[] };
  status: 'active' | 'inactive';
}

function conditionToRow(c: Condition | ConditionGroup): DraftCondition | null {
  if ('field' in c) {
    return {
      field: c.field,
      operator: c.operator,
      value: c.value !== undefined ? String(c.value) : '',
    };
  }
  return null; // nested groups not represented in flat row editor
}

function defaultDraft(rule?: Rule): DraftRule {
  const rows: DraftCondition[] = rule?.conditions.conditions
    .map(conditionToRow)
    .filter((r): r is DraftCondition => r !== null) ?? [];

  return {
    name: rule?.name ?? '',
    priority: rule?.priority ?? 100,
    scope: rule?.scope ?? {},
    conditionLogic: rule?.conditions.logic ?? 'and',
    conditionRows: rows.length > 0 ? rows : [{ field: '', operator: 'eq', value: '' }],
    actions: rule?.actions?.length
      ? rule.actions
      : [{ type: 'flag_for_review', parameters: { reason: '' } }],
    timeWindow: {
      enabled: !!rule?.timeWindow,
      startDate: rule?.timeWindow?.startDate
        ? new Date(rule.timeWindow.startDate).toISOString().slice(0, 10)
        : '',
      endDate: rule?.timeWindow?.endDate
        ? new Date(rule.timeWindow.endDate).toISOString().slice(0, 10)
        : '',
      startTime: rule?.timeWindow?.startTime ?? '',
      endTime: rule?.timeWindow?.endTime ?? '',
      daysOfWeek: rule?.timeWindow?.daysOfWeek ?? [],
    },
    status: (rule?.status === 'active' || rule?.status === 'inactive') ? rule.status : 'active',
  };
}

function parseConditionValue(operator: ConditionOperator, raw: string): unknown {
  if (operator === 'is_null' || operator === 'is_not_null') return undefined;
  if (operator === 'in' || operator === 'not_in') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const num = Number(raw);
  if (raw !== '' && !isNaN(num)) return num;
  return raw;
}

function buildPayload(draft: DraftRule): Omit<Rule, '_id' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'> {
  const conditions: ConditionGroup = {
    logic: draft.conditionLogic,
    conditions: draft.conditionRows
      .filter((r) => r.field.trim() !== '')
      .map((r): Condition => ({
        field: r.field.trim(),
        operator: r.operator,
        value: parseConditionValue(r.operator, r.value),
      })),
  };

  const tw: TimeWindow | undefined = draft.timeWindow.enabled
    ? {
        startDate: draft.timeWindow.startDate ? new Date(draft.timeWindow.startDate) : undefined,
        endDate: draft.timeWindow.endDate ? new Date(draft.timeWindow.endDate) : undefined,
        startTime: draft.timeWindow.startTime || undefined,
        endTime: draft.timeWindow.endTime || undefined,
        daysOfWeek: draft.timeWindow.daysOfWeek.length > 0 ? draft.timeWindow.daysOfWeek : undefined,
      }
    : undefined;

  return {
    name: draft.name,
    priority: draft.priority,
    scope: draft.scope,
    conditions,
    actions: draft.actions,
    ...(tw ? { timeWindow: tw } : {}),
    status: draft.status,
  };
}

export function VisualRuleEditor({ rule, onClose }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftRule>(() => defaultDraft(rule));
  const [actionsJson, setActionsJson] = useState<string>(() =>
    JSON.stringify(draft.actions, null, 2),
  );
  const [actionsError, setActionsError] = useState<string>('');

  function handleActionsChange(val: string) {
    setActionsJson(val);
    try {
      const parsed = JSON.parse(val) as RuleAction[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setActionsError('Must be a non-empty JSON array');
        return;
      }
      setActionsError('');
      setDraft((d) => ({ ...d, actions: parsed }));
    } catch {
      setActionsError('Invalid JSON');
    }
  }

  function addConditionRow() {
    setDraft((d) => ({
      ...d,
      conditionRows: [...d.conditionRows, { field: '', operator: 'eq', value: '' }],
    }));
  }

  function removeConditionRow(idx: number) {
    setDraft((d) => ({
      ...d,
      conditionRows: d.conditionRows.filter((_, i) => i !== idx),
    }));
  }

  function updateConditionRow(idx: number, patch: Partial<DraftCondition>) {
    setDraft((d) => ({
      ...d,
      conditionRows: d.conditionRows.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = rule ? `${SERVICE_BASE}/api/rules/${rule._id}` : `${SERVICE_BASE}/api/rules`;
      const method = rule ? 'PATCH' : 'POST';
      const resp = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(draft)),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Save failed' }));
        throw new Error((err as { error?: { message?: string }; message?: string }).error?.message ?? 'Save failed');
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); onClose(); },
  });

  const disabled = saveMutation.isPending || !!actionsError;
  const noValueOps: ConditionOperator[] = ['is_null', 'is_not_null'];

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>{rule ? 'Edit Rule' : 'New Rule'}</h3>

        {/* Name */}
        <label style={styles.label}>
          Name
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            style={styles.input}
          />
        </label>

        {/* Priority */}
        <label style={styles.label}>
          Priority <span style={styles.hint}>(lower number = higher priority)</span>
          <input
            type="number"
            value={draft.priority}
            onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
            style={styles.input}
          />
        </label>

        {/* Scope */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Scope (leave blank for global)</legend>
          {(['school', 'major', 'class', 'cohort'] as const).map((key) => (
            <label key={key} style={{ ...styles.label, marginBottom: 8 }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
              <input
                value={(draft.scope as Record<string, string>)[key] ?? ''}
                onChange={(e) => setDraft((d) => ({
                  ...d,
                  scope: {
                    ...d.scope,
                    ...(e.target.value ? { [key]: e.target.value } : { [key]: undefined }),
                  },
                }))}
                placeholder="e.g. Engineering"
                style={styles.input}
              />
            </label>
          ))}
        </fieldset>

        {/* Conditions */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Conditions</legend>

          <label style={{ ...styles.label, marginBottom: 10 }}>
            Match logic
            <select
              value={draft.conditionLogic}
              onChange={(e) => setDraft((d) => ({
                ...d, conditionLogic: e.target.value as 'and' | 'or',
              }))}
              style={{ ...styles.select, width: 220 }}
            >
              <option value="and">AND — all conditions must match</option>
              <option value="or">OR — any condition may match</option>
            </select>
          </label>

          {draft.conditionRows.map((row, idx) => (
            <div key={idx} style={styles.condRow}>
              <input
                placeholder="field (e.g. order.total)"
                value={row.field}
                onChange={(e) => updateConditionRow(idx, { field: e.target.value })}
                style={{ ...styles.input, flex: 2, minWidth: 0 }}
              />
              <select
                value={row.operator}
                onChange={(e) => updateConditionRow(idx, { operator: e.target.value as ConditionOperator })}
                style={{ ...styles.select, flex: 1.5, minWidth: 0 }}
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              {noValueOps.includes(row.operator) ? (
                <div style={{ flex: 1.5 }} />
              ) : (
                <input
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => updateConditionRow(idx, { value: e.target.value })}
                  style={{ ...styles.input, flex: 1.5, minWidth: 0 }}
                />
              )}
              <button
                onClick={() => removeConditionRow(idx)}
                disabled={draft.conditionRows.length <= 1}
                style={styles.removeBtn}
                title="Remove condition"
              >
                ×
              </button>
            </div>
          ))}

          <button onClick={addConditionRow} style={styles.addCondBtn}>
            + Add Condition
          </button>
        </fieldset>

        {/* Actions */}
        <label style={styles.label}>
          Actions <span style={styles.hint}>(JSON array of {'{'}type, parameters{'}'})</span>
          <textarea
            value={actionsJson}
            onChange={(e) => handleActionsChange(e.target.value)}
            rows={5}
            style={{ ...styles.input, fontFamily: 'monospace', resize: 'vertical' }}
          />
          {actionsError && <span style={styles.fieldError}>{actionsError}</span>}
        </label>

        {/* Time Window */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={draft.timeWindow.enabled}
                onChange={(e) => setDraft((d) => ({
                  ...d,
                  timeWindow: { ...d.timeWindow, enabled: e.target.checked },
                }))}
              />
              Time Window (optional)
            </label>
          </legend>
          {draft.timeWindow.enabled && (
            <>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={styles.label}>
                  Start Date
                  <input
                    type="date"
                    value={draft.timeWindow.startDate}
                    onChange={(e) => setDraft((d) => ({
                      ...d, timeWindow: { ...d.timeWindow, startDate: e.target.value },
                    }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  End Date
                  <input
                    type="date"
                    value={draft.timeWindow.endDate}
                    onChange={(e) => setDraft((d) => ({
                      ...d, timeWindow: { ...d.timeWindow, endDate: e.target.value },
                    }))}
                    style={styles.input}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={styles.label}>
                  Start Time <span style={styles.hint}>(HH:MM)</span>
                  <input
                    type="time"
                    value={draft.timeWindow.startTime}
                    onChange={(e) => setDraft((d) => ({
                      ...d, timeWindow: { ...d.timeWindow, startTime: e.target.value },
                    }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  End Time <span style={styles.hint}>(HH:MM)</span>
                  <input
                    type="time"
                    value={draft.timeWindow.endTime}
                    onChange={(e) => setDraft((d) => ({
                      ...d, timeWindow: { ...d.timeWindow, endTime: e.target.value },
                    }))}
                    style={styles.input}
                  />
                </label>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Days of Week</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const).map((day, idx) => {
                    const selected = draft.timeWindow.daysOfWeek.includes(idx);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setDraft((d) => ({
                          ...d,
                          timeWindow: {
                            ...d.timeWindow,
                            daysOfWeek: selected
                              ? d.timeWindow.daysOfWeek.filter((v) => v !== idx)
                              : [...d.timeWindow.daysOfWeek, idx].sort(),
                          },
                        }))}
                        style={{
                          background: selected ? '#3b82f6' : '#0f172a',
                          color: selected ? '#fff' : '#94a3b8',
                          border: `1px solid ${selected ? '#3b82f6' : '#334155'}`,
                          borderRadius: 4,
                          padding: '0.3rem 0.5rem',
                          fontSize: 12,
                          cursor: 'pointer',
                          minWidth: 40,
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </fieldset>

        {/* Status */}
        <label style={styles.label}>
          Status
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as 'active' | 'inactive' }))}
            style={styles.select}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        {saveMutation.isError && <p style={styles.error}>{saveMutation.error.message}</p>}

        <div style={styles.actionsBar}>
          <button onClick={() => saveMutation.mutate()} disabled={disabled} style={styles.saveBtn}>
            {saveMutation.isPending ? 'Saving…' : 'Save Rule'}
          </button>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, overflowY: 'auto' as const },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '1.5rem', width: 580, maxHeight: '90vh', overflowY: 'auto' as const },
  title: { color: '#f1f5f9', fontSize: 16, margin: '0 0 1.25rem' },
  fieldset: { border: '1px solid #334155', borderRadius: 6, padding: '0.75rem', marginBottom: 14 },
  legend: { color: '#94a3b8', fontSize: 12, padding: '0 6px' },
  label: { display: 'flex', flexDirection: 'column' as const, gap: 5, color: '#94a3b8', fontSize: 13, marginBottom: 14 },
  hint: { color: '#475569', fontWeight: 400 },
  input: { background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#f1f5f9', padding: '0.4rem 0.6rem', fontSize: 13, outline: 'none' },
  select: { background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#f1f5f9', padding: '0.4rem 0.6rem', fontSize: 13 },
  condRow: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 },
  removeBtn: { background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 14, lineHeight: '1', flexShrink: 0 },
  addCondBtn: { background: 'transparent', border: '1px dashed #334155', color: '#64748b', borderRadius: 4, padding: '0.3rem 0.75rem', fontSize: 12, cursor: 'pointer', marginTop: 4 },
  actionsBar: { display: 'flex', gap: 8, marginTop: 16 },
  saveBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1.25rem', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  cancelBtn: { background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: 4, padding: '0.5rem 1.25rem', fontSize: 13, cursor: 'pointer' },
  error: { color: '#f87171', fontSize: 12, marginTop: 4 },
  fieldError: { color: '#f87171', fontSize: 11 },
} as const;
