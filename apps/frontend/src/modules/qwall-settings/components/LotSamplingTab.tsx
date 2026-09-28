import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PartNumber, SamplingCell, LotConfiguration } from '../types';
import { fetchLotConfiguration, fetchPartNumbers, fetchSamplingMatrix, saveLotConfiguration } from '../services/qwallSettingsService';

const EMPTY = { mode: 'GENERAL' as const, general_lot_size: 120, inspection_index: '2.5', enabled: false, models: [] };
const INDEXES = ['.010', '.015', '.025', '.040', '.065', '.10', '.15', '.25', '.40', '.65', '1.0', '1.5', '2.5', '4.0', '6.5', '10.0'];

type Form = Omit<LotConfiguration, 'bu_id'>;
const positive = (value: string) => /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;

export default function LotSamplingTab({ buId }: { buId?: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const tr = (key: string) => t(`qwallSettings.lots.${key}`);
  const { data: matrix = [], isLoading: matrixLoading, error: matrixError } = useQuery({ queryKey: ['qwall-sampling-matrix'], queryFn: fetchSamplingMatrix });
  const { data: saved, isLoading: configLoading, error: configError } = useQuery({ queryKey: ['qwall-lot-config', buId], queryFn: () => fetchLotConfiguration(buId!), enabled: !!buId });
  const { data: partNumbers = [], isLoading: pnLoading } = useQuery({ queryKey: ['qwall-lot-pns', buId], queryFn: () => fetchPartNumbers(buId), enabled: !!buId });
  const [form, setForm] = useState<Form>(EMPTY);
  const [generalInput, setGeneralInput] = useState('120');
  const [lotInput, setLotInput] = useState('120');
  const [previewIndex, setPreviewIndex] = useState('2.5');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(saved ? { mode: saved.mode, general_lot_size: saved.general_lot_size, inspection_index: saved.inspection_index, enabled: saved.enabled, models: saved.models } : EMPTY);
    setGeneralInput(String(saved?.general_lot_size ?? 120));
    setLotInput(String(saved?.general_lot_size ?? 120));
    setPreviewIndex(saved?.inspection_index ?? '2.5');
    setMessage('');
  }, [buId, saved]);

  const rows = useMemo(() => [...new Set(matrix.map(cell => cell.lot_min))].sort((a, b) => a - b).map(min => {
    const cell = matrix.find(c => c.lot_min === min)!;
    return { min, max: cell.lot_max };
  }), [matrix]);
  const previewSize = positive(lotInput);
  const activeCell = matrix.find(c => previewSize !== null && c.lot_min <= previewSize && (c.lot_max === null || c.lot_max >= previewSize) && c.inspection_index === previewIndex);
  const sample = activeCell ? activeCell.sample_size ?? previewSize : null;
  const modelSize = (pn: PartNumber) => form.models.find(m => m.pn_id === pn.pn_id)?.lot_size;
  const setModelSize = (pnId: number, input: string) => {
    const lotSize = positive(input);
    setForm(old => ({ ...old, models: [
      ...old.models.filter(m => m.pn_id !== pnId),
      ...(lotSize === null ? [] : [{ pn_id: pnId, lot_size: lotSize }]),
    ] }));
  };
  const save = async () => {
    if (!buId) return;
    setMessage('');
    setSaving(true);
    try {
      await saveLotConfiguration(buId, {
        ...form,
        general_lot_size: form.mode === 'GENERAL' ? positive(generalInput) : null,
        models: form.mode === 'BY_MODEL' ? form.models : [],
      });
      await qc.invalidateQueries({ queryKey: ['qwall-lot-config', buId] });
      setMessage(tr('saved'));
    } catch (err) {
      const response = err as { response?: { data?: { error?: string } } };
      setMessage(response.response?.data?.error ?? tr('saveError'));
    } finally { setSaving(false); }
  };

  return <div style={s.page}>
    <section style={s.card}>
      <h2 style={s.heading}>{tr('configuration')}</h2>
      <p style={s.hint}>{tr('perBu')}</p>
      {!buId ? <p>{tr('selectBu')}</p> : configLoading || pnLoading ? <p>{tr('loading')}</p> : configError ? <p role="alert">{tr('loadError')}</p> : <>
        <div style={s.fields}>
          <label style={s.label}>{tr('mode')}
            <select style={s.input} value={form.mode} onChange={e => setForm(old => ({ ...old, mode: e.target.value as Form['mode'] }))}>
              <option value="GENERAL">{tr('general')}</option><option value="BY_MODEL">{tr('byModel')}</option>
            </select>
          </label>
          {form.mode === 'GENERAL' && <label style={s.label}>{tr('generalSize')}
            <input style={s.input} type="number" min="2" value={generalInput} onChange={e => { setGeneralInput(e.target.value); setLotInput(e.target.value); setForm(old => ({ ...old, general_lot_size: positive(e.target.value) })); }} />
          </label>}
          <label style={s.label}>{tr('index')}
            <select style={s.input} value={form.inspection_index} onChange={e => { setPreviewIndex(e.target.value); setForm(old => ({ ...old, inspection_index: e.target.value })); }}>
              {INDEXES.map(index => <option key={index} value={index}>{index}</option>)}
            </select>
          </label>
          <label style={s.check}><input type="checkbox" checked={form.enabled} onChange={e => setForm(old => ({ ...old, enabled: e.target.checked }))} /> {tr('enabled')}</label>
        </div>
        {form.mode === 'BY_MODEL' && <div style={s.modelList}>
          {partNumbers.length === 0 ? <p>{tr('noModels')}</p> : partNumbers.map(pn => <label key={pn.pn_id} style={s.modelRow}>
            <span>{pn.ssiPN}</span><input aria-label={`${tr('lotSize')} ${pn.ssiPN}`} type="number" min="2" style={s.input} value={modelSize(pn) ?? ''} onChange={e => setModelSize(pn.pn_id, e.target.value)} placeholder={tr('lotSize')} />
          </label>)}
        </div>}
        <div style={s.actions}><span role="status">{message}</span><button style={s.button} disabled={saving || matrixLoading || !!matrixError} onClick={save}>{saving ? tr('saving') : tr('save')}</button></div>
      </>}
    </section>
    <section style={s.card}>
      <h2 style={s.heading}>{tr('matrix')}</h2>
      <p style={s.hint}>{tr('source')}</p>
      <div style={s.fields}>
        <label style={s.label}>{tr('previewLot')}<input style={s.input} type="number" min="2" value={lotInput} onChange={e => setLotInput(e.target.value)} /></label>
        <label style={s.label}>{tr('previewIndex')}<select style={s.input} value={previewIndex} onChange={e => setPreviewIndex(e.target.value)}>{INDEXES.map(index => <option key={index}>{index}</option>)}</select></label>
        <strong role="status" style={s.result}>{sample === null ? tr('unavailable') : `${tr('required')}: ${sample.toLocaleString()} ${tr('pieces')}`}</strong>
      </div>
      {matrixLoading ? <p>{tr('loading')}</p> : matrixError ? <p role="alert">{tr('loadError')}</p> : <div style={s.scroll}><table style={s.table}>
        <thead><tr><th style={{ ...s.cell, ...s.sticky }}>{tr('lotRange')}</th>{INDEXES.map(index => <th key={index} style={{ ...s.cell, ...(index === previewIndex ? s.axis : {}) }}>{index}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.min}><th style={{ ...s.cell, ...s.sticky, ...(activeCell?.lot_min === row.min ? s.axis : {}) }}>{row.min.toLocaleString()}–{row.max?.toLocaleString() ?? '∞'}</th>{INDEXES.map(index => {
          const cell: SamplingCell | undefined = matrix.find(c => c.lot_min === row.min && c.inspection_index === index);
          const selected = activeCell?.lot_min === row.min && index === previewIndex;
          return <td key={index} style={{ ...s.cell, ...(selected ? s.selected : {}) }} aria-label={selected ? `${tr('selected')}: ${cell?.sample_size ?? tr('entireLot')}` : undefined}>{cell ? cell.sample_size ?? '*' : '—'}</td>;
        })}</tr>)}</tbody>
      </table></div>}
      <p style={s.hint}>{tr('star')} {tr('missingRow')}</p>
    </section>
  </div>;
}

const s: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: '1.25rem' }, card: { padding: '1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', minWidth: 0 },
  heading: { fontSize: '1.1rem', margin: '0 0 .4rem' }, hint: { color: 'var(--color-text-secondary)', fontSize: '.85rem' },
  fields: { display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end', margin: '1rem 0' }, label: { display: 'grid', gap: '.35rem', fontSize: '.85rem', fontWeight: 600 },
  input: { padding: '.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', minWidth: 110 },
  check: { alignSelf: 'end', paddingBottom: '.5rem' }, modelList: { display: 'grid', gap: '.5rem', maxHeight: 340, overflowY: 'auto' },
  modelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', maxWidth: 420 },
  actions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' },
  button: { border: 0, borderRadius: 'var(--radius-md)', padding: '.6rem 1rem', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' },
  result: { padding: '.6rem', color: 'var(--color-primary)' }, scroll: { overflowX: 'auto', maxWidth: '100%' },
  table: { borderCollapse: 'collapse', fontSize: '.8rem', width: '100%', minWidth: 1050 },
  cell: { border: '1px solid var(--color-border)', padding: '.45rem', textAlign: 'center', whiteSpace: 'nowrap', background: 'var(--color-surface)' },
  sticky: { position: 'sticky', left: 0, zIndex: 1, textAlign: 'left' }, axis: { background: 'rgba(45, 112, 204, .2)' },
  selected: { background: '#1368c4', color: '#fff', fontWeight: 800, outline: '3px solid #ffb400', outlineOffset: '-3px' },
};
