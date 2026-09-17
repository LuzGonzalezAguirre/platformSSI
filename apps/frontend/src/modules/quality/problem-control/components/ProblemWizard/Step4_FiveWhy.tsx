import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../../api/problemApi';
import type { FiveWhyAnalysis, FiveWhyCategory } from '../../types/problem.types';
import { StepMediaBar } from '../shared/StepMediaBar';
import { useApprovalUsers } from '../../hooks/useCatalogs';
import { useWizardStore } from '../../store/wizardStore';

const CATEGORIES: { key: FiveWhyCategory; label: string }[] = [
  { key: 'made', label: 'Why Made (Creation)' },
  { key: 'escape', label: 'Why Escape (Detection)' },
  { key: 'systemic', label: 'Systemic' },
];

const WHY_KEYS = ['why1', 'why2', 'why3', 'why4', 'why5'] as const;
type CatKey = FiveWhyCategory;

interface RowState {
  rootCauseId?: number;
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
}

interface LineState {
  order: number;
  rows: Record<CatKey, RowState>;
}

const emptyRow = (): RowState => ({ why1: '', why2: '', why3: '', why4: '', why5: '' });
const emptyLine = (order: number): LineState => ({
  order,
  rows: { made: emptyRow(), escape: emptyRow(), systemic: emptyRow() },
});

const deriveRootCause = (row: RowState) => row.why5 || row.why4 || row.why3 || row.why2 || row.why1 || '';

function buildLines(analyses: FiveWhyAnalysis[]): LineState[] {
  const map = new Map<number, LineState>();
  analyses.forEach((analysis) => {
    const category = analysis.category as CatKey;
    analysis.root_causes.forEach((rc) => {
      if (!map.has(rc.order)) map.set(rc.order, emptyLine(rc.order));
      map.get(rc.order)!.rows[category] = {
        rootCauseId: rc.id,
        why1: rc.why1,
        why2: rc.why2,
        why3: rc.why3,
        why4: rc.why4,
        why5: rc.why5,
      };
    });
  });
  return map.size ? Array.from(map.values()).sort((a, b) => a.order - b.order) : [emptyLine(1)];
}

function buildFiveWhyIdMap(analyses: FiveWhyAnalysis[]): Record<CatKey, number | undefined> {
  const result: Record<CatKey, number | undefined> = { made: undefined, escape: undefined, systemic: undefined };
  analyses.forEach((analysis) => { result[analysis.category as CatKey] = analysis.id; });
  return result;
}

export const Step4_FiveWhy: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = Number(id) || 0;
  const qc = useQueryClient();
  const { formData, updateFormData, setStepValidation } = useWizardStore();
  const { data: approvalUsers = [] } = useApprovalUsers();

  const { data: analyses = [], isLoading } = useQuery<FiveWhyAnalysis[]>({
    queryKey: ['fiveWhy', problemId],
    queryFn: () => problemApi.getFiveWhyAnalyses(problemId),
    enabled: !!problemId,
    staleTime: 30000,
  });

  const [lines, setLines] = useState<LineState[]>([emptyLine(1)]);
  const [fiveWhyIds, setFiveWhyIds] = useState<Record<CatKey, number | undefined>>({
    made: undefined,
    escape: undefined,
    systemic: undefined,
  });
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const linesRef = useRef(lines);
  const fwIdsRef = useRef(fiveWhyIds);
  const inFlightRef = useRef<Set<string>>(new Set());
  const initialised = useRef(false);

  linesRef.current = lines;
  fwIdsRef.current = fiveWhyIds;

  useEffect(() => {
    if (!isLoading && !initialised.current) {
      initialised.current = true;
      setLines(buildLines(analyses));
      setFiveWhyIds(buildFiveWhyIdMap(analyses));
    }
  }, [isLoading, analyses]);

  useEffect(() => {
    const valid = lines.every((line) =>
      CATEGORIES.every(({ key }) => {
        const row = line.rows[key];
        return Boolean(row.why1.trim() && row.why2.trim() && row.why3.trim());
      })
    );
    setStepValidation(4, valid);
  }, [lines, setStepValidation]);

  const handleChange = useCallback((order: number, cat: CatKey, field: string, value: string) => {
    setLines((prev) => prev.map((line) =>
      line.order !== order ? line : {
        ...line,
        rows: { ...line.rows, [cat]: { ...line.rows[cat], [field]: value } },
      }
    ));
  }, []);

  const handleBlur = useCallback(async (order: number, cat: CatKey) => {
    if (!problemId) return;
    const key = `${order}-${cat}`;
    if (inFlightRef.current.has(key)) return;
    const line = linesRef.current.find((item) => item.order === order);
    if (!line) return;
    const row = line.rows[cat];
    if (!WHY_KEYS.some((field) => row[field])) return;

    inFlightRef.current.add(key);
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      let fwId = fwIdsRef.current[cat];
      if (!fwId) {
        const created = await problemApi.createFiveWhyAnalysis({ problem: problemId, category: cat });
        fwId = created.id;
        setFiveWhyIds((prev) => {
          const next = { ...prev, [cat]: fwId };
          fwIdsRef.current = next;
          return next;
        });
      }

      const payload = {
        five_why: fwId,
        order,
        why1: row.why1,
        why2: row.why2,
        why3: row.why3,
        why4: row.why4,
        why5: row.why5,
      };
      const current = linesRef.current.find((item) => item.order === order)?.rows[cat];
      const rootCauseId = current?.rootCauseId ?? row.rootCauseId;
      if (rootCauseId) {
        await problemApi.updateRootCause(rootCauseId, payload);
      } else {
        const created = await problemApi.createRootCause(payload as any);
        setLines((prev) => {
          const next = prev.map((item) => item.order !== order ? item : {
            ...item,
            rows: { ...item.rows, [cat]: { ...item.rows[cat], rootCauseId: created.id } },
          });
          linesRef.current = next;
          return next;
        });
      }
      qc.invalidateQueries({ queryKey: ['fiveWhy', problemId] });
    } finally {
      inFlightRef.current.delete(key);
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [problemId, qc]);

  const addLine = useCallback(() => {
    const nextOrder = linesRef.current.length ? Math.max(...linesRef.current.map((line) => line.order)) + 1 : 1;
    setLines((prev) => {
      const next = [...prev, emptyLine(nextOrder)];
      linesRef.current = next;
      return next;
    });
  }, []);

  const deleteLine = useCallback(async (order: number) => {
    if (!window.confirm('Delete this entire line block?')) return;
    const line = linesRef.current.find((item) => item.order === order);
    if (!line) return;
    const ids = CATEGORIES.map((category) => line.rows[category.key].rootCauseId).filter(Boolean) as number[];
    await Promise.all(ids.map((rootCauseId) => problemApi.deleteRootCause(rootCauseId)));
    setLines((prev) => {
      const next = prev.filter((item) => item.order !== order);
      linesRef.current = next;
      return next;
    });
    qc.invalidateQueries({ queryKey: ['fiveWhy', problemId] });
  }, [problemId, qc]);

  if (isLoading) return <p style={s.loading}>Loading 5 Why analysis…</p>;
  if (!problemId) return <div style={s.saveFirst}>Save the problem in D1 first, then come back to fill in the 5 Why analysis.</div>;

  const routing = [
    { label: 'Manufacturing', field: 'manufacturing_approver' as const, approver: formData.manufacturing_approver },
    { label: 'Production', field: 'production_approver' as const, approver: formData.production_approver },
    { label: 'Maintenance', field: 'maintenance_approver' as const, approver: formData.maintenance_approver },
  ];

  return (
    <div style={s.wrapper}>
      <div style={s.headerRow}>
        <h3 style={s.title}>D4 — 5 Why Analysis</h3>
        <button onClick={addLine} style={s.addBtn}>+ Add Line</button>
      </div>

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <colgroup>
            <col style={{ width: '56px' }} />
            <col style={{ width: '148px' }} />
            <col style={{ width: '60px' }} />
            <col />
            <col style={{ width: '180px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={s.th}>Line</th>
              <th style={s.th}>Category</th>
              <th style={s.th}>Why #</th>
              <th style={s.th}>Why Description</th>
              <th style={s.th}>Root Cause (Last Why)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, lineIdx) => CATEGORIES.map((category, catIdx) => WHY_KEYS.map((whyKey, whyIdx) => {
              const row = line.rows[category.key];
              const isSaving = savingKeys.has(`${line.order}-${category.key}`);
              const rootCause = deriveRootCause(row);
              const firstLine = catIdx === 0 && whyIdx === 0;
              const firstCategory = whyIdx === 0;
              return (
                <tr key={`${line.order}-${category.key}-${whyKey}`} style={firstLine ? { borderTop: '2px solid var(--color-primary)' } : undefined}>
                  {firstLine && (
                    <td rowSpan={15} style={{ ...s.td, ...s.lineCell }}>
                      <div style={s.lineLabel}>{lineIdx + 1}</div>
                      {lines.length > 1 && <button onClick={() => deleteLine(line.order)} style={s.delLineBtn}>×</button>}
                    </td>
                  )}
                  {firstCategory && (
                    <td rowSpan={5} style={{ ...s.td, ...s.catCell }}>
                      <span>{category.label}</span>
                      {isSaving && <span style={s.savingDot}>saving…</span>}
                    </td>
                  )}
                  <td style={{ ...s.td, ...s.whyNumCell }}>Why {whyIdx + 1}</td>
                  <td style={s.td}>
                    <textarea
                      value={row[whyKey]}
                      onChange={(event) => handleChange(line.order, category.key, whyKey, event.target.value)}
                      onBlur={() => handleBlur(line.order, category.key)}
                      style={s.textarea}
                      rows={1}
                      placeholder={`Why ${whyIdx + 1}…`}
                    />
                  </td>
                  {firstCategory && (
                    <td rowSpan={5} style={{ ...s.td, ...s.rcCell }}>
                      {rootCause ? <span style={s.rcText}>{rootCause}</span> : <span style={s.rcPlaceholder}>Complete at least Why 1–3</span>}
                    </td>
                  )}
                </tr>
              );
            })))}
          </tbody>
        </table>
      </div>

      <div style={s.hint}>Fields save automatically on focus loss. Why 1, Why 2 and Why 3 are required; Root Cause is the last completed Why.</div>

      <section style={s.routingSection}>
        <div>
          <h3 style={s.routingTitle}>Final Approval Routing</h3>
          <p style={s.routingHelp}>
            Select who will represent Manufacturing, Production and Maintenance in the final approval stage. No approval is performed here. After Submit, the four approvers will sign and comment from the dedicated Approval page.
          </p>
        </div>
        <div style={s.routingGrid}>
          {routing.map((item) => (
            <div key={item.label} style={s.routingCard}>
              <label style={s.routingLabel}>{item.label} approver</label>
              <select
                value={item.approver?.id || ''}
                onChange={(event) => {
                  const selected = approvalUsers.find((user) => user.id === Number(event.target.value)) || null;
                  updateFormData({ [item.field]: selected } as any);
                }}
                style={s.routingSelect}
              >
                <option value="">Select approver...</option>
                {approvalUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}{user.job_title ? ` · ${user.job_title}` : ''}
                  </option>
                ))}
              </select>
              <div style={s.routingStatus}>Signature will be requested after Submit.</div>
            </div>
          ))}
        </div>
      </section>

      {problemId && <StepMediaBar problemId={problemId} step="step4" />}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  loading: { color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 600 },
  addBtn: { padding: '0.375rem 0.875rem', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'fixed' },
  th: { padding: '0.5rem 0.625rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  td: { padding: '0.375rem 0.5rem', border: '1px solid var(--color-border)', verticalAlign: 'middle' },
  lineCell: { textAlign: 'center', backgroundColor: 'var(--color-surface)' },
  lineLabel: { fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)' },
  delLineBtn: { marginTop: '0.25rem', width: '1.375rem', height: '1.375rem', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' },
  catCell: { backgroundColor: '#f8f9fa', fontWeight: 600, textAlign: 'center' },
  savingDot: { display: 'block', fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' },
  whyNumCell: { textAlign: 'center', fontWeight: 500, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '0.75rem' },
  textarea: { width: '100%', resize: 'vertical', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.375rem', fontSize: '0.8125rem', fontFamily: 'inherit', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '2rem', boxSizing: 'border-box', lineHeight: 1.4 },
  rcCell: { backgroundColor: '#fffbeb', textAlign: 'center', padding: '0.5rem' },
  rcText: { fontSize: '0.8125rem', fontWeight: 500, color: '#92400e', wordBreak: 'break-word', display: 'block' },
  rcPlaceholder: { fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', display: 'block' },
  hint: { fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  routingSection: { padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)' },
  routingTitle: { margin: 0, fontSize: '1rem', fontWeight: 700 },
  routingHelp: { margin: '0.35rem 0 1rem', color: 'var(--color-text-secondary)', fontSize: '0.8rem', lineHeight: 1.45 },
  routingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' },
  routingCard: { padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg)' },
  routingLabel: { display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' },
  routingSelect: { width: '100%', padding: '0.45rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' },
  routingStatus: { marginTop: '0.5rem', color: '#64748b', fontSize: '0.75rem' },
  saveFirst: { padding: '1.5rem', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' },
};
