// D7 — Control / Prevention
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StepMediaBar } from '../shared/StepMediaBar';
import { useWizardStore } from '../../store/wizardStore';
import { useQualityUsers } from '../../hooks/useCatalogs';
import { useProblemDetail } from '../../hooks/useProblemDetail';
import { useProblemUpdate } from '../../hooks/useProblemMutations';
import {
  usePreventionActions,
  usePreventionActionCreate,
  usePreventionActionUpdate,
  usePreventionActionDelete,
} from '../../hooks/usePreventionActions';
import type { PreventionAction } from '../../types/problem.types';

const emptyForm = {
  action: '', response: '', responsible: undefined as any,
  due_date: '', completion_date: '', ongoing: false,
};

const triState = (val: boolean | null | undefined): 'yes' | 'no' | 'na' =>
  val === true ? 'yes' : val === null || val === undefined ? 'na' : 'no';

export const Step7_Prevention: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;

  const setStepValidation = useWizardStore((s) => s.setStepValidation);
  const { data: qualityUsers } = useQualityUsers();
  const { data: problem } = useProblemDetail(problemId);
  const updateProblem = useProblemUpdate();

  const { data: actions = [], isLoading } = usePreventionActions(problemId);
  const createMutation = usePreventionActionCreate();
  const updateMutation = usePreventionActionUpdate();
  const deleteMutation = usePreventionActionDelete();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<typeof emptyForm>(emptyForm);
  const [fmeaSaving, setFmeaSaving] = useState(false);

  const [fmea, setFmea] = useState({
    update_req: 'no' as 'yes' | 'no' | 'na',
    responsible_id: '' as number | '',
    due: '', completed: '', re_eval: '',
  });
  const [cp, setCp] = useState({
    update_req: 'no' as 'yes' | 'no' | 'na',
    responsible_id: '' as number | '',
    due: '', completed: '', re_eval: '',
  });

  useEffect(() => { setStepValidation(7, true); }, [setStepValidation]);

  useEffect(() => {
    if (!problem) return;
    setFmea({
      update_req: triState(problem.fmea_update_required),
      responsible_id: problem.fmea_responsible?.id || '',
      due: problem.fmea_due || '',
      completed: problem.fmea_completed || '',
      re_eval: problem.fmea_re_eval || '',
    });
    setCp({
      update_req: triState(problem.control_plan_update_required),
      responsible_id: problem.control_plan_responsible?.id || '',
      due: problem.control_plan_due || '',
      completed: problem.control_plan_completed || '',
      re_eval: problem.control_plan_re_eval || '',
    });
  }, [problem?.id]);

  const handleSaveFmea = async () => {
    if (!problemId) return;
    setFmeaSaving(true);
    try {
      await updateProblem.mutateAsync({
        id: problemId,
        data: {
          fmea_update_required: fmea.update_req === 'yes',
          fmea_responsible_id: fmea.responsible_id || null,
          fmea_due: fmea.due || null,
          fmea_completed: fmea.completed || null,
          fmea_re_eval: fmea.re_eval || null,
          control_plan_update_required: cp.update_req === 'yes',
          control_plan_responsible_id: cp.responsible_id || null,
          control_plan_due: cp.due || null,
          control_plan_completed: cp.completed || null,
          control_plan_re_eval: cp.re_eval || null,
        },
      });
    } catch (e: any) {
      alert(`Error: ${e.response?.data?.detail || e.message}`);
    } finally {
      setFmeaSaving(false);
    }
  };

  const handleAdd = () => { setIsAdding(true); setEditingId(null); setFormData(emptyForm); };
  const handleEdit = (a: PreventionAction) => {
    setIsAdding(false); setEditingId(a.id);
    setFormData({ action: a.action, response: a.response || '', responsible: a.responsible,
      due_date: a.due_date || '', completion_date: a.completion_date || '', ongoing: a.ongoing });
  };
  const handleCancel = () => { setIsAdding(false); setEditingId(null); setFormData(emptyForm); };

  const handleSave = async () => {
    if (!problemId) { alert('Please save the problem first.'); return; }
    if (!formData.action.trim()) { alert('Action description is required.'); return; }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: {
          action: formData.action, response: formData.response, ongoing: formData.ongoing,
          due_date: formData.due_date || null, completion_date: formData.completion_date || null,
          responsible_id: formData.responsible?.id,
        }});
      } else {
        await createMutation.mutateAsync({
          problem: problemId, action: formData.action, response: formData.response,
          responsible_id: formData.responsible?.id, due_date: formData.due_date || null,
          completion_date: formData.completion_date || null, ongoing: formData.ongoing,
        } as any);
      }
      handleCancel();
    } catch (e: any) { alert(`Error: ${e.response?.data?.detail || e.message}`); }
  };

  const handleDelete = async (actionId: number) => {
    if (!window.confirm('Delete this action?')) return;
    try { await deleteMutation.mutateAsync({ id: actionId, problemId: problemId! }); }
    catch (e: any) { alert(`Error: ${(e as any).response?.data?.detail || e.message}`); }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : '—';

  const ActionForm = () => (
    <div style={s.formCard}>
      <div style={s.formGrid}>
        <div style={s.fg}>
          <label style={s.lbl}>Action <span style={s.req}>*</span></label>
          <textarea value={formData.action} rows={2} style={s.ta}
            onChange={e => setFormData({ ...formData, action: e.target.value })}
            placeholder="Describe the action..." />
        </div>
        <div style={s.fg}>
          <label style={s.lbl}>Response / Notes</label>
          <textarea value={formData.response} rows={2} style={s.ta}
            onChange={e => setFormData({ ...formData, response: e.target.value })}
            placeholder="Results or notes..." />
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
  );

  const ActionTable: React.FC<{ items: PreventionAction[] }> = ({ items }) =>
    items.length === 0 ? (
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
          {items.map((a, i) => (
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
    );


  return (
    <div style={s.container}>
      <h2 style={s.title}>D7 — Control / Prevention</h2>
      <p style={s.subtitle}>Define preventive measures and update process controls to prevent recurrence.</p>

      {!problemId && <div style={s.warning}>Please save the problem first.</div>}

      {/* ── Prevention Actions ── */}
      <div style={s.section}>
        {!isAdding && !editingId && (
          <div style={s.sectionHeader}>
            <button onClick={handleAdd} style={s.addBtn} disabled={!problemId}>+ Add Action</button>
          </div>
        )}
        {(isAdding || editingId) && <ActionForm />}
        <div style={s.tableWrap}>
          {isLoading ? <p style={s.empty}>Loading...</p> : <ActionTable items={actions} />}
        </div>
      </div>

      {/* ── FMEA Revision ── */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>PROCESS FMEA REVISION</h3>
        <div style={s.revisionGrid}>
          <div style={s.fg}>
            <label style={s.lbl}>Update Required?</label>
            <select style={s.sel} value={fmea.update_req}
              onChange={e => setFmea({ ...fmea, update_req: e.target.value as any })}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="na">N/A</option>
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Responsible</label>
            <select style={s.sel} value={fmea.responsible_id}
              onChange={e => setFmea({ ...fmea, responsible_id: Number(e.target.value) || '' })}>
              <option value="">Select...</option>
              {Array.isArray(qualityUsers) && qualityUsers.map(u =>
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Completed</label>
            <input type="date" style={s.inp} value={fmea.completed}
              onChange={e => setFmea({ ...fmea, completed: e.target.value })} />
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Due</label>
            <input type="date" style={s.inp} value={fmea.due}
              onChange={e => setFmea({ ...fmea, due: e.target.value })} />
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Re-Eval</label>
            <input type="date" style={s.inp} value={fmea.re_eval}
              onChange={e => setFmea({ ...fmea, re_eval: e.target.value })} />
          </div>
        </div>
      </div>

      {/* ── Control Plan Revision ── */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>CONTROL PLAN REVISION</h3>
        <div style={s.revisionGrid}>
          <div style={s.fg}>
            <label style={s.lbl}>Update Required?</label>
            <select style={s.sel} value={cp.update_req}
              onChange={e => setCp({ ...cp, update_req: e.target.value as any })}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="na">N/A</option>
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Responsible</label>
            <select style={s.sel} value={cp.responsible_id}
              onChange={e => setCp({ ...cp, responsible_id: Number(e.target.value) || '' })}>
              <option value="">Select...</option>
              {Array.isArray(qualityUsers) && qualityUsers.map(u =>
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Completed</label>
            <input type="date" style={s.inp} value={cp.completed}
              onChange={e => setCp({ ...cp, completed: e.target.value })} />
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Due</label>
            <input type="date" style={s.inp} value={cp.due}
              onChange={e => setCp({ ...cp, due: e.target.value })} />
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Re-Eval</label>
            <input type="date" style={s.inp} value={cp.re_eval}
              onChange={e => setCp({ ...cp, re_eval: e.target.value })} />
          </div>
        </div>
        <div style={s.saveRow}>
          <button onClick={handleSaveFmea} style={s.saveBtn} disabled={!problemId || fmeaSaving}>
            {fmeaSaving ? 'Saving...' : 'Save FMEA & Control Plan'}
          </button>
        </div>
      </div>

      {/* ── Other Docs to Review ── */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>OTHER DOCS TO REVIEW
          <span style={s.cardNote}> (Use when additional documents require a review)</span>
        </h3>
        <div style={s.tableWrap}>
          <p style={s.empty}>No records were found. Refine your search criteria and search again.</p>
        </div>
      </div>

      {/* ── Recurrences ── */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>Recurrences</h3>
        <div style={s.recurrenceBox}>
          <span style={s.recurrenceCount}>{problem?.recurrence_count ?? 0}</span>
          <span style={s.recurrenceLabel}>
            {(problem?.recurrence_count ?? 0) === 0
              ? 'No recurrences recorded for this problem.'
              : `related problem${(problem?.recurrence_count ?? 0) !== 1 ? 's' : ''} found.`}
          </span>
        </div>
      </div>

      {problemId && <StepMediaBar problemId={problemId} step="step7" />}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  title: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' },
  warning: { padding: '0.875rem', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '0.5rem', color: '#92400e', fontSize: '0.875rem', marginBottom: '1rem' },
  section: { marginBottom: '1.5rem' },
  sectionHeader: { marginBottom: '0.75rem' },
  addBtn: { padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  formCard: { padding: '1rem 1.25rem', backgroundColor: 'var(--color-bg-secondary)', border: '2px solid #3b82f6', borderRadius: '0.5rem', marginBottom: '1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' },
  formRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end', marginBottom: '0.75rem' },
  fg: { display: 'flex', flexDirection: 'column' },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  req: { color: '#ef4444' },
  inp: { padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' },
  ta: { padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', resize: 'vertical' },
  sel: { padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' },
  chkLbl: { display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' },
  cancelBtn: { padding: '0.375rem 0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' },
  saveBtn: { padding: '0.375rem 0.875rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '0.375rem' },
  empty: { padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 },
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
  card: { border: '1px solid var(--color-border)', borderRadius: '0.5rem', marginBottom: '1.25rem', overflow: 'hidden' },
  cardTitle: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', padding: '0.75rem 1rem', backgroundColor: '#f3f4f6', borderBottom: '1px solid var(--color-border)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' },
  cardNote: { fontWeight: 400, fontSize: '0.75rem', textTransform: 'none', color: 'var(--color-text-secondary)', letterSpacing: 0 },
  revisionGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', padding: '1rem' },
  saveRow: { display: 'flex', justifyContent: 'flex-end', padding: '0 1rem 1rem' },
  recurrenceBox: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem' },
  recurrenceCount: { fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 },
  recurrenceLabel: { fontSize: '0.875rem', color: 'var(--color-text-secondary)' },
};
