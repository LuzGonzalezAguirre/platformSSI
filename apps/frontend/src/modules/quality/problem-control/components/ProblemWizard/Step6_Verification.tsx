// D6 — Verification
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StepMediaBar } from '../shared/StepMediaBar';
import { useWizardStore } from '../../store/wizardStore';
import { useQualityUsers } from '../../hooks/useCatalogs';
import {
  useVerificationActions,
  useVerificationActionCreate,
  useVerificationActionUpdate,
  useVerificationActionDelete,
} from '../../hooks/useVerificationActions';
import type { VerificationAction } from '../../types/problem.types';

const emptyForm = {
  action: '',
  response: '',
  responsible: undefined as any,
  due_date: '',
  completion_date: '',
  ongoing: false,
};

export const Step6_Verification: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;

  const setStepValidation = useWizardStore((s) => s.setStepValidation);
  const { data: qualityUsers } = useQualityUsers();
  const { data: actions = [], isLoading } = useVerificationActions(problemId);

  const createMutation = useVerificationActionCreate();
  const updateMutation = useVerificationActionUpdate();
  const deleteMutation = useVerificationActionDelete();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<typeof emptyForm>(emptyForm);

  useEffect(() => { setStepValidation(6, true); }, [setStepValidation]);

  const handleAdd = () => { setIsAdding(true); setEditingId(null); setFormData(emptyForm); };

  const handleEdit = (action: VerificationAction) => {
    setIsAdding(false);
    setEditingId(action.id);
    setFormData({
      action: action.action,
      response: action.response || '',
      responsible: action.responsible,
      due_date: action.due_date || '',
      completion_date: action.completion_date || '',
      ongoing: action.ongoing,
    });
  };

  const handleCancel = () => { setIsAdding(false); setEditingId(null); setFormData(emptyForm); };

  const handleSave = async () => {
    if (!problemId) { alert('Please save the problem first.'); return; }
    if (!formData.action.trim()) { alert('Action description is required.'); return; }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          data: {
            action: formData.action, response: formData.response, ongoing: formData.ongoing,
            due_date: formData.due_date || null, completion_date: formData.completion_date || null,
            responsible_id: formData.responsible?.id,
          },
        });
      } else {
        await createMutation.mutateAsync({
          problem: problemId, action: formData.action, response: formData.response,
          responsible_id: formData.responsible?.id, due_date: formData.due_date || null,
          completion_date: formData.completion_date || null, ongoing: formData.ongoing,
        } as any);
      }
      handleCancel();
    } catch (error: any) {
      alert(`Error saving action: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDelete = async (actionId: number) => {
    if (!window.confirm('Delete this verification action?')) return;
    try { await deleteMutation.mutateAsync({ id: actionId, problemId: problemId! }); }
    catch (error: any) { alert(`Error: ${error.response?.data?.detail || error.message}`); }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div style={s.container}>
      <h2 style={s.title}>D6 — Verification</h2>
      <p style={s.subtitle}>Verify the effectiveness of corrective actions.</p>

      {!problemId && <div style={s.warning}>Please save the problem first.</div>}

      {/* Add button */}
      {!isAdding && !editingId && (
        <button onClick={handleAdd} style={s.addBtn} disabled={!problemId}>
          + Add Verification Action
        </button>
      )}

      {/* Inline form */}
      {(isAdding || editingId) && (
        <div style={s.formCard}>
          <div style={s.formGrid}>
            <div style={s.fg}>
              <label style={s.lbl}>Action <span style={s.req}>*</span></label>
              <textarea value={formData.action} rows={2} style={s.ta}
                onChange={e => setFormData({ ...formData, action: e.target.value })}
                placeholder="Describe the verification action..." />
            </div>
            <div style={s.fg}>
              <label style={s.lbl}>Response / Results</label>
              <textarea value={formData.response} rows={2} style={s.ta}
                onChange={e => setFormData({ ...formData, response: e.target.value })}
                placeholder="Verification results or notes..." />
            </div>
          </div>
          <div style={s.formRow}>
            <div style={s.fg}>
              <label style={s.lbl}>Responsible</label>
              <select style={s.sel} value={formData.responsible?.id || ''}
                onChange={e => setFormData({ ...formData, responsible: qualityUsers?.find(u => u.id === parseInt(e.target.value)) })}>
                <option value="">Select...</option>
                {Array.isArray(qualityUsers) && qualityUsers.map(u =>
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
            <div style={s.fg}>
              <label style={s.lbl}>Due Date</label>
              <input type="date" style={s.inp} value={formData.due_date}
                onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
            </div>
            <div style={s.fg}>
              <label style={s.lbl}>Completion Date</label>
              <input type="date" style={s.inp} value={formData.completion_date}
                onChange={e => setFormData({ ...formData, completion_date: e.target.value })} />
            </div>
            <div style={{ ...s.fg, justifyContent: 'flex-end', paddingBottom: '0.25rem' }}>
              <label style={s.chkLbl}>
                <input type="checkbox" checked={formData.ongoing}
                  onChange={e => setFormData({ ...formData, ongoing: e.target.checked })} />
                <span>Ongoing</span>
              </label>
            </div>
          </div>
          <div style={s.formActions}>
            <button onClick={handleCancel} style={s.cancelBtn} disabled={isSaving}>Cancel</button>
            <button onClick={handleSave} style={s.saveBtn} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={s.tableWrap}>
        {isLoading ? (
          <p style={s.empty}>Loading...</p>
        ) : actions.length === 0 ? (
          <p style={s.empty}>No records were found. Refine your search criteria and search again.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Add Date','Due Date','Completion Date','Ongoing','Action','Response','Responsible',''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {actions.map((a, i) => (
                <tr key={a.id} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                  <td style={s.tdDate}>{fmt(a.add_date)}</td>
                  <td style={s.tdDate}>{fmt(a.due_date)}</td>
                  <td style={s.tdDate}>{fmt(a.completion_date)}</td>
                  <td style={s.tdCenter}>{a.ongoing ? <span style={s.dot}>●</span> : '—'}</td>
                  <td style={s.td}>{a.action}</td>
                  <td style={s.tdMuted}>{a.response || '—'}</td>
                  <td style={s.tdNowrap}>{a.responsible ? `${a.responsible.first_name} ${a.responsible.last_name}` : '—'}</td>
                  <td style={s.tdBtn}>
                    <button onClick={() => handleEdit(a)} style={s.editBtn} disabled={isSaving}>Edit</button>
                    <button onClick={() => handleDelete(a.id)} style={s.delBtn} disabled={isSaving}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {problemId && <StepMediaBar problemId={problemId} step="step6" />}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  title: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' },
  warning: { padding: '0.875rem', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '0.5rem', color: '#92400e', fontSize: '0.875rem', marginBottom: '1rem' },
  addBtn: { padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.25rem' },
  formCard: { padding: '1rem 1.25rem', backgroundColor: 'var(--color-bg-secondary)', border: '2px solid #3b82f6', borderRadius: '0.5rem', marginBottom: '1.25rem' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' },
  formRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end', marginBottom: '0.75rem' },
  fg: { display: 'flex', flexDirection: 'column' },
  lbl: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  req: { color: '#ef4444' },
  inp: { padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' },
  ta: { padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', resize: 'vertical' },
  sel: { padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' },
  chkLbl: { display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' },
  cancelBtn: { padding: '0.375rem 0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' },
  saveBtn: { padding: '0.375rem 0.875rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '0.5rem' },
  empty: { padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '760px' },
  th: { padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap' },
  trEven: { backgroundColor: 'var(--color-bg-primary)' },
  trOdd: { backgroundColor: '#f9fafb' },
  td: { padding: '0.6rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)' },
  tdDate: { padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  tdCenter: { padding: '0.6rem 0.75rem', textAlign: 'center', color: '#3b82f6', fontSize: '1rem' },
  tdMuted: { padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  tdNowrap: { padding: '0.6rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' },
  tdBtn: { padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' },
  dot: { color: '#3b82f6', fontWeight: 700 },
  editBtn: { padding: '0.2rem 0.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', marginRight: '0.25rem' },
  delBtn: { padding: '0.2rem 0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' },
};
