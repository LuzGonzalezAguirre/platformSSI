import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../../api/problemApi';
import type { FiveWhyAnalysis, FiveWhyCategory } from '../../types/problem.types';
import { StepMediaBar } from '../shared/StepMediaBar';

const CATEGORIES: { key: FiveWhyCategory; label: string }[] = [
  { key: 'made',     label: 'Why Made (Creation)' },
  { key: 'escape',   label: 'Why Escape (Detection)' },
  { key: 'systemic', label: 'Systemic' },
];

const WHY_KEYS = ['why1', 'why2', 'why3', 'why4', 'why5'] as const;
const CA_KEYS  = ['ca1',  'ca2',  'ca3',  'ca4',  'ca5']  as const;

type CatKey = FiveWhyCategory;

interface RowState {
  rootCauseId?: number;
  why1: string; why2: string; why3: string; why4: string; why5: string;
  ca1:  string; ca2:  string; ca3:  string; ca4:  string; ca5:  string;
}

interface LineState {
  order: number;
  rows: Record<CatKey, RowState>;
}

function emptyRow(): RowState {
  return { why1:'', why2:'', why3:'', why4:'', why5:'', ca1:'', ca2:'', ca3:'', ca4:'', ca5:'' };
}

function emptyLine(order: number): LineState {
  return { order, rows: { made: emptyRow(), escape: emptyRow(), systemic: emptyRow() } };
}

function deriveRootCause(row: RowState): string {
  return row.ca5 || row.ca4 || row.ca3 || row.ca2 || row.ca1 || '';
}

function buildLines(analyses: FiveWhyAnalysis[]): LineState[] {
  const map = new Map<number, LineState>();
  for (const a of analyses) {
    const cat = a.category as CatKey;
    for (const rc of a.root_causes) {
      if (!map.has(rc.order)) map.set(rc.order, emptyLine(rc.order));
      const line = map.get(rc.order)!;
      line.rows[cat] = {
        rootCauseId: rc.id,
        why1: rc.why1, why2: rc.why2, why3: rc.why3, why4: rc.why4, why5: rc.why5,
        ca1:  rc.ca1,  ca2:  rc.ca2,  ca3:  rc.ca3,  ca4:  rc.ca4,  ca5:  rc.ca5,
      };
    }
  }
  if (map.size === 0) return [emptyLine(1)];
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

function buildFiveWhyIdMap(analyses: FiveWhyAnalysis[]): Record<CatKey, number | undefined> {
  const m: Record<CatKey, number | undefined> = { made: undefined, escape: undefined, systemic: undefined };
  for (const a of analyses) m[a.category as CatKey] = a.id;
  return m;
}

function extractErrorMessage(e: any): string {
  const data = e?.response?.data;
  if (!data) return e?.message || 'Error saving';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  // DRF validation errors: { field: ["msg"] } or { non_field_errors: ["msg"] }
  const msgs: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) msgs.push(`${k}: ${v.join(', ')}`);
    else msgs.push(`${k}: ${v}`);
  }
  return msgs.join('\n') || 'Error saving';
}

export const Step4_FiveWhy: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = Number(id) || 0;
  const qc = useQueryClient();

  const { data: analyses = [], isLoading } = useQuery<FiveWhyAnalysis[]>({
    queryKey: ['fiveWhy', problemId],
    queryFn: () => problemApi.getFiveWhyAnalyses(problemId),
    enabled: !!problemId,
    staleTime: 30000,
  });

  const [lines, setLines] = useState<LineState[]>([emptyLine(1)]);
  const [fiveWhyIds, setFiveWhyIds] = useState<Record<CatKey, number | undefined>>({
    made: undefined, escape: undefined, systemic: undefined,
  });
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // Refs for immediate reads inside async callbacks (avoid stale closures)
  const linesRef     = useRef(lines);
  const fwIdsRef     = useRef(fiveWhyIds);
  const inFlightRef  = useRef<Set<string>>(new Set()); // tracks in-progress saves
  const initialised  = useRef(false);

  linesRef.current  = lines;
  fwIdsRef.current  = fiveWhyIds;

  useEffect(() => {
    if (!isLoading && !initialised.current) {
      initialised.current = true;
      setLines(buildLines(analyses));
      setFiveWhyIds(buildFiveWhyIdMap(analyses));
    }
  }, [isLoading, analyses]);

  const handleChange = useCallback((order: number, cat: CatKey, field: string, value: string) => {
    setLines(prev => prev.map(line =>
      line.order !== order ? line : {
        ...line,
        rows: { ...line.rows, [cat]: { ...line.rows[cat], [field]: value } },
      }
    ));
  }, []);

  const handleBlur = useCallback(async (order: number, cat: CatKey) => {
    if (!problemId) return; // problem not saved yet

    const key = `${order}-${cat}`;

    // Use ref so we always read the current in-flight set (not a stale closure)
    if (inFlightRef.current.has(key)) return;

    // Read latest state via refs
    const line = linesRef.current.find(l => l.order === order);
    if (!line) return;
    const row = line.rows[cat];

    const hasContent = WHY_KEYS.some(k => row[k]) || CA_KEYS.some(k => row[k]);
    if (!hasContent) return;

    inFlightRef.current.add(key);
    setSavingKeys(prev => new Set(prev).add(key));

    try {
      // Ensure FiveWhyAnalysis container exists for this category
      let fwId = fwIdsRef.current[cat];
      if (!fwId) {
        const created = await problemApi.createFiveWhyAnalysis({ problem: problemId, category: cat });
        fwId = created.id;
        setFiveWhyIds(prev => { const next = { ...prev, [cat]: fwId }; fwIdsRef.current = next; return next; });
      }

      const payload = {
        five_why: fwId,
        order,
        why1: row.why1, why2: row.why2, why3: row.why3, why4: row.why4, why5: row.why5,
        ca1:  row.ca1,  ca2:  row.ca2,  ca3:  row.ca3,  ca4:  row.ca4,  ca5:  row.ca5,
      };

      // Re-read rootCauseId via ref in case another async call updated it
      const currentRow = linesRef.current.find(l => l.order === order)?.rows[cat];
      const rcId = currentRow?.rootCauseId ?? row.rootCauseId;

      if (rcId) {
        await problemApi.updateRootCause(rcId, payload);
      } else {
        const created = await problemApi.createRootCause(payload as any);
        // Update both state and ref immediately
        setLines(prev => {
          const next = prev.map(l =>
            l.order !== order ? l : {
              ...l,
              rows: { ...l.rows, [cat]: { ...l.rows[cat], rootCauseId: created.id } },
            }
          );
          linesRef.current = next;
          return next;
        });
      }
      qc.invalidateQueries({ queryKey: ['fiveWhy', problemId] });
    } catch (e: any) {
      alert(extractErrorMessage(e));
    } finally {
      inFlightRef.current.delete(key);
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [problemId, qc]); // ← minimal deps; reads latest values via refs

  const addLine = useCallback(() => {
    const nextOrder = linesRef.current.length > 0
      ? Math.max(...linesRef.current.map(l => l.order)) + 1
      : 1;
    setLines(prev => { const next = [...prev, emptyLine(nextOrder)]; linesRef.current = next; return next; });
  }, []);

  const deleteLine = useCallback(async (order: number) => {
    if (!window.confirm('Delete this entire line block?')) return;
    const line = linesRef.current.find(l => l.order === order);
    if (!line) return;

    const ids = CATEGORIES.map(c => line.rows[c.key].rootCauseId).filter(Boolean) as number[];
    await Promise.all(ids.map(id => problemApi.deleteRootCause(id)));
    setLines(prev => { const next = prev.filter(l => l.order !== order); linesRef.current = next; return next; });
    qc.invalidateQueries({ queryKey: ['fiveWhy', problemId] });
  }, [problemId, qc]);

  if (isLoading) return <p style={s.loading}>Loading 5 Why analysis…</p>;

  if (!problemId) return (
    <div style={s.saveFirst}>
      Save the problem in D1 first, then come back to fill in the 5 Why analysis.
    </div>
  );

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
            <col />
            <col style={{ width: '160px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={s.th}>Line</th>
              <th style={s.th}>Category</th>
              <th style={s.th}>Why #</th>
              <th style={s.th}>Why Description</th>
              <th style={s.th}>Corrective Action</th>
              <th style={s.th}>Root Cause</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, lineIdx) =>
              CATEGORIES.map((catDef, catIdx) =>
                WHY_KEYS.map((whyKey, whyIdx) => {
                  const caKey = CA_KEYS[whyIdx];
                  const row = line.rows[catDef.key];
                  const isSaving    = savingKeys.has(`${line.order}-${catDef.key}`);
                  const rootCause   = deriveRootCause(row);
                  const isFirstOfLine = catIdx === 0 && whyIdx === 0;
                  const isFirstOfCat  = whyIdx === 0;

                  return (
                    <tr
                      key={`${line.order}-${catDef.key}-${whyKey}`}
                      style={isFirstOfLine ? { ...s.tr, borderTop: '2px solid var(--color-primary)' } : s.tr}
                    >
                      {isFirstOfLine && (
                        <td rowSpan={15} style={{ ...s.td, ...s.lineCell }}>
                          <div style={s.lineLabel}>{lineIdx + 1}</div>
                          {lines.length > 1 && (
                            <button onClick={() => deleteLine(line.order)} style={s.delLineBtn} title="Delete line">×</button>
                          )}
                        </td>
                      )}

                      {isFirstOfCat && (
                        <td rowSpan={5} style={{ ...s.td, ...s.catCell }}>
                          <span style={s.catLabel}>{catDef.label}</span>
                          {isSaving && <span style={s.savingDot}>saving…</span>}
                        </td>
                      )}

                      <td style={{ ...s.td, ...s.whyNumCell }}>Why {whyIdx + 1}</td>

                      <td style={s.td}>
                        <textarea
                          value={row[whyKey]}
                          onChange={e => handleChange(line.order, catDef.key, whyKey, e.target.value)}
                          onBlur={() => handleBlur(line.order, catDef.key)}
                          style={s.textarea}
                          rows={1}
                          placeholder={`Why ${whyIdx + 1}…`}
                        />
                      </td>

                      <td style={s.td}>
                        <textarea
                          value={row[caKey]}
                          onChange={e => handleChange(line.order, catDef.key, caKey, e.target.value)}
                          onBlur={() => handleBlur(line.order, catDef.key)}
                          style={s.textarea}
                          rows={1}
                          placeholder={`CA ${whyIdx + 1}…`}
                        />
                      </td>

                      {isFirstOfCat && (
                        <td rowSpan={5} style={{ ...s.td, ...s.rcCell }}>
                          {rootCause
                            ? <span style={s.rcText}>{rootCause}</span>
                            : <span style={s.rcPlaceholder}>Auto-derived from last CA</span>
                          }
                        </td>
                      )}
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>

      <div style={s.hint}>
        Fields save automatically on focus loss. Root Cause is derived from the last filled Corrective Action per category.
      </div>

      {problemId && <StepMediaBar problemId={problemId} step="step4" />}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrapper:    { display: 'flex', flexDirection: 'column', gap: '1rem' },
  loading:    { color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  headerRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:      { margin: 0, fontSize: '1rem', fontWeight: 600 },
  addBtn: {
    padding: '0.375rem 0.875rem',
    backgroundColor: 'var(--color-primary)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'fixed' },
  th: {
    padding: '0.5rem 0.625rem',
    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
    textAlign: 'left', fontWeight: 600, fontSize: '0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
  },
  td:         { padding: '0.375rem 0.5rem', border: '1px solid var(--color-border)', verticalAlign: 'middle' },
  tr:         {},
  lineCell:   { textAlign: 'center', backgroundColor: 'var(--color-surface)', verticalAlign: 'middle' },
  lineLabel:  { fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.25rem' },
  delLineBtn: {
    marginTop: '0.25rem', width: '1.375rem', height: '1.375rem',
    backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
    borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1,
  },
  catCell:    { backgroundColor: '#f8f9fa', fontWeight: 600, verticalAlign: 'middle', textAlign: 'center' },
  catLabel:   { fontSize: '0.75rem', color: 'var(--color-text)', display: 'block', lineHeight: 1.3 },
  savingDot:  { display: 'block', fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' },
  whyNumCell: { textAlign: 'center', fontWeight: 500, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '0.75rem' },
  textarea: {
    width: '100%', resize: 'vertical',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    padding: '0.25rem 0.375rem', fontSize: '0.8125rem', fontFamily: 'inherit',
    backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
    minHeight: '2rem', boxSizing: 'border-box', lineHeight: 1.4,
  },
  rcCell:        { backgroundColor: '#fffbeb', verticalAlign: 'middle', textAlign: 'center', padding: '0.5rem' },
  rcText:        { fontSize: '0.8125rem', fontWeight: 500, color: '#92400e', wordBreak: 'break-word', display: 'block' },
  rcPlaceholder: { fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', display: 'block' },
  hint:          { fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  saveFirst:     { padding: '1.5rem', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' },
};
