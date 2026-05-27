// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/Step5_CorrectiveActions.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWizardStore } from '../../store/wizardStore';
import { useQualityUsers } from '../../hooks/useCatalogs';
import { useFiveWhyAnalyses } from '../../hooks/useFiveWhyActions';
import {
  useCorrectiveActions,
  useCorrectiveActionCreate,
  useCorrectiveActionUpdate,
  useCorrectiveActionDelete,
} from '../../hooks/useCorrectiveActions';
import type { CorrectiveAction, FiveWhyAnalysis, RootCause } from '../../types/problem.types';
import { StepMediaBar } from '../shared/StepMediaBar';

const makeEmptyForm = (root_cause_id: number) => ({
  action: '',
  response: '',
  responsible: undefined as any,
  due_date: '',
  completion_date: '',
  ongoing: false,
  root_cause_id,
});

const EMPTY_ANALYSES: FiveWhyAnalysis[] = [];
const EMPTY_ACTIONS: CorrectiveAction[] = [];

type EditState = { rootCauseId: number; actionId: number | null };

export const Step5_CorrectiveActions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;

  const setStepValidation = useWizardStore((s) => s.setStepValidation);
  const { data: qualityUsers } = useQualityUsers();
  const { data: analyses = EMPTY_ANALYSES } = useFiveWhyAnalyses(problemId);
  const { data: actions = EMPTY_ACTIONS, isLoading } = useCorrectiveActions(problemId);

  const createMutation = useCorrectiveActionCreate();
  const updateMutation = useCorrectiveActionUpdate();
  const deleteMutation = useCorrectiveActionDelete();

  const [editState, setEditState] = useState<EditState | null>(null);
  const [formData, setFormData] = useState<ReturnType<typeof makeEmptyForm> | null>(null);

  const allRootCauses = useMemo<(RootCause & { categoryLabel: string })[]>(
    () => analyses.flatMap((a) =>
      (a.root_causes || []).map((rc) => ({ ...rc, categoryLabel: a.category_display }))
    ),
    [analyses]
  );

  useEffect(() => {
    if (allRootCauses.length === 0) { setStepValidation(5, false); return; }
    const covered = allRootCauses.every((rc) => actions.some((a) => a.root_cause_id === rc.id));
    setStepValidation(5, covered);
  }, [actions, allRootCauses, setStepValidation]);

  const handleAdd = (rootCauseId: number) => {
    setEditState({ rootCauseId, actionId: null });
    setFormData(makeEmptyForm(rootCauseId));
  };

  const handleEdit = (action: CorrectiveAction) => {
    setEditState({ rootCauseId: action.root_cause_id, actionId: action.id });
    setFormData({
      action: action.action,
      response: action.response || '',
      responsible: action.responsible,
      due_date: action.due_date || '',
      completion_date: action.completion_date || '',
      ongoing: action.ongoing,
      root_cause_id: action.root_cause_id,
    });
  };

  const handleCancel = () => { setEditState(null); setFormData(null); };

  const handleSave = async () => {
    if (!problemId || !formData || !editState) return;
    if (!formData.action.trim()) { alert('Action description is required.'); return; }
    try {
      if (editState.actionId) {
        await updateMutation.mutateAsync({
          id: editState.actionId,
          data: {
            action: formData.action,
            response: formData.response,
            ongoing: formData.ongoing,
            due_date: formData.due_date || null,
            completion_date: formData.completion_date || null,
            responsible_id: formData.responsible?.id,
            root_cause_id: formData.root_cause_id,
          },
        });
      } else {
        await createMutation.mutateAsync({
          problem: problemId,
          action: formData.action,
          response: formData.response,
          responsible_id: formData.responsible?.id,
          due_date: formData.due_date || null,
          completion_date: formData.completion_date || null,
          ongoing: formData.ongoing,
          root_cause_id: formData.root_cause_id,
        } as any);
      }
      handleCancel();
    } catch (error: any) {
      alert(`Error saving action: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDelete = async (actionId: number) => {
    if (!window.confirm('Delete this corrective action?')) return;
    try {
      await deleteMutation.mutateAsync({ id: actionId, problemId: problemId! });
    } catch (error: any) {
      alert(`Error deleting action: ${error.response?.data?.detail || error.message}`);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>D5 — Corrective Actions</h2>
      <p style={styles.description}>
        Define permanent corrective actions for each root cause identified in the Five Why analysis.
      </p>

      {!problemId && (
        <div style={styles.warningBox}>Please save the problem first before adding corrective actions.</div>
      )}

      {allRootCauses.length === 0 && (
        <div style={styles.infoBox}>
          Complete Step 4 (Five Why Analysis) first to define root causes before adding corrective actions.
        </div>
      )}

      {isLoading && <p style={styles.loadingText}>Loading...</p>}

      {allRootCauses.map((rc) => {
        const rcActions = actions.filter((a) => a.root_cause_id === rc.id);
        const isEditingHere = editState?.rootCauseId === rc.id;
        const covered = rcActions.length > 0;

        return (
          <div key={rc.id} style={{ ...styles.rcSection, ...(covered ? styles.rcSectionCovered : {}) }}>
            {/* Root cause header */}
            <div style={styles.rcHeader}>
              <div style={styles.rcHeaderLeft}>
                <span style={{ ...styles.rcCategoryBadge, ...(covered ? styles.rcCategoryBadgeDone : {}) }}>
                  {rc.categoryLabel}
                </span>
                <span style={styles.rcOrder}>RC #{rc.order}</span>
                <span style={styles.rcText}>{rc.root_cause}</span>
              </div>
              <div style={styles.rcHeaderRight}>
                <span style={{ ...styles.rcCount, ...(covered ? styles.rcCountDone : {}) }}>
                  {rcActions.length} action{rcActions.length !== 1 ? 's' : ''}
                </span>
                {!isEditingHere && (
                  <button
                    onClick={() => handleAdd(rc.id)}
                    style={styles.addButton}
                    disabled={!problemId || isSaving}
                  >
                    + Add Action
                  </button>
                )}
              </div>
            </div>

            {/* Inline add/edit form */}
            {isEditingHere && formData && (
              <div style={styles.formCard}>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Action <span style={styles.required}>*</span></label>
                    <textarea
                      value={formData.action}
                      onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                      placeholder="Describe the corrective action..."
                      rows={2}
                      style={styles.textarea}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Response / Notes</label>
                    <textarea
                      value={formData.response}
                      onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                      placeholder="Results or notes..."
                      rows={2}
                      style={styles.textarea}
                    />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Responsible</label>
                    <select
                      value={formData.responsible?.id || ''}
                      onChange={(e) => {
                        const user = qualityUsers?.find((u) => u.id === parseInt(e.target.value));
                        setFormData({ ...formData, responsible: user });
                      }}
                      style={styles.select}
                    >
                      <option value="">Select...</option>
                      {Array.isArray(qualityUsers) && qualityUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Due Date</label>
                    <input
                      type="date" value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Completion Date</label>
                    <input
                      type="date" value={formData.completion_date}
                      onChange={(e) => setFormData({ ...formData, completion_date: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroupCenter}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox" checked={formData.ongoing}
                        onChange={(e) => setFormData({ ...formData, ongoing: e.target.checked })}
                        style={styles.checkbox}
                      />
                      <span>Ongoing</span>
                    </label>
                  </div>
                </div>
                <div style={styles.formActions}>
                  <button onClick={handleCancel} style={styles.cancelButton} disabled={isSaving}>Cancel</button>
                  <button onClick={handleSave} style={styles.saveButton} disabled={isSaving}>
                    {isSaving ? 'Saving...' : editState.actionId ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Actions table */}
            {rcActions.length > 0 && (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Root Cause</th>
                      <th style={styles.th}>Add Date</th>
                      <th style={styles.th}>Due Date</th>
                      <th style={styles.th}>Completion Date</th>
                      <th style={styles.thCenter}>Ongoing</th>
                      <th style={styles.th}>Action</th>
                      <th style={styles.th}>Response</th>
                      <th style={styles.th}>Responsible</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rcActions.map((action, idx) => (
                      <tr key={action.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                        <td style={styles.tdRc}>
                          <span style={styles.rcInlineBadge} title={rc.root_cause}>
                            {rc.root_cause.length > 40 ? rc.root_cause.slice(0, 40) + '…' : rc.root_cause}
                          </span>
                        </td>
                        <td style={styles.tdDate}>{fmt(action.add_date)}</td>
                        <td style={styles.tdDate}>{fmt(action.due_date)}</td>
                        <td style={styles.tdDate}>{fmt(action.completion_date)}</td>
                        <td style={styles.tdCenter}>
                          {action.ongoing ? (
                            <span style={styles.ongoingDot} title="Ongoing">●</span>
                          ) : '—'}
                        </td>
                        <td style={styles.tdAction}>{action.action}</td>
                        <td style={styles.tdResponse}>{action.response || '—'}</td>
                        <td style={styles.tdResponsible}>
                          {action.responsible
                            ? `${action.responsible.first_name} ${action.responsible.last_name}`
                            : '—'}
                        </td>
                        <td style={styles.tdButtons}>
                          <button
                            onClick={() => handleEdit(action)}
                            style={styles.editButton}
                            disabled={isSaving}
                          >Edit</button>
                          <button
                            onClick={() => handleDelete(action.id)}
                            style={styles.deleteButton}
                            disabled={isSaving}
                          >Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rcActions.length === 0 && !isEditingHere && (
              <p style={styles.emptyRc}>No corrective actions yet for this root cause.</p>
            )}
          </div>
        );
      })}

      {problemId && <StepMediaBar problemId={problemId} step="step5" />}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: '1.5rem' },
  sectionTitle: {
    fontSize: '1.5rem', fontWeight: 700,
    color: 'var(--color-text-primary)', marginBottom: '0.5rem',
  },
  description: {
    color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem',
  },
  warningBox: {
    padding: '1rem', backgroundColor: '#fef3c7', border: '1px solid #f59e0b',
    borderRadius: '0.5rem', color: '#92400e', fontSize: '0.875rem', marginBottom: '1rem',
  },
  infoBox: {
    padding: '1rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: '0.5rem', color: '#1e40af', fontSize: '0.875rem', marginBottom: '1rem',
  },
  loadingText: { color: 'var(--color-text-secondary)', fontSize: '0.875rem' },

  // Root cause section
  rcSection: {
    border: '1px solid #e5e7eb', borderRadius: '0.5rem',
    marginBottom: '1.25rem', overflow: 'hidden',
    borderLeft: '4px solid #f59e0b',
  },
  rcSectionCovered: { borderLeft: '4px solid #10b981' },
  rcHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '0.75rem 1rem', backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '0.5rem',
  },
  rcHeaderLeft: { display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1, flexWrap: 'wrap' },
  rcHeaderRight: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 },
  rcCategoryBadge: {
    display: 'inline-block', padding: '0.125rem 0.5rem',
    backgroundColor: '#fef3c7', color: '#92400e',
    fontSize: '0.7rem', fontWeight: 700, borderRadius: '0.25rem', flexShrink: 0,
  },
  rcCategoryBadgeDone: { backgroundColor: '#d1fae5', color: '#065f46' },
  rcOrder: {
    fontSize: '0.75rem', fontWeight: 700,
    color: 'var(--color-text-secondary)', flexShrink: 0, marginTop: '0.125rem',
  },
  rcText: {
    fontSize: '0.875rem', fontWeight: 500,
    color: 'var(--color-text-primary)', lineHeight: 1.4,
  },
  rcCount: {
    fontSize: '0.75rem', padding: '0.125rem 0.5rem',
    backgroundColor: '#fef3c7', color: '#92400e',
    borderRadius: '1rem', fontWeight: 600,
  },
  rcCountDone: { backgroundColor: '#d1fae5', color: '#065f46' },
  addButton: {
    padding: '0.375rem 0.75rem', backgroundColor: '#10b981',
    color: 'white', border: 'none', borderRadius: '0.375rem',
    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  },

  // Inline form
  formCard: {
    padding: '1rem 1.25rem', backgroundColor: 'var(--color-bg-secondary)',
    borderBottom: '1px solid #e5e7eb',
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem',
  },
  formRow: {
    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem',
    alignItems: 'end', marginBottom: '0.75rem',
  },
  formGroup: { display: 'flex', flexDirection: 'column' },
  formGroupCenter: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.25rem' },
  label: {
    fontSize: '0.8rem', fontWeight: 500,
    color: 'var(--color-text-secondary)', marginBottom: '0.25rem',
  },
  required: { color: '#ef4444' },
  input: {
    padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)',
    borderRadius: '0.375rem', fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)',
  },
  textarea: {
    padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)',
    borderRadius: '0.375rem', fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)',
    resize: 'vertical',
  },
  select: {
    padding: '0.4rem 0.625rem', border: '1px solid var(--color-border)',
    borderRadius: '0.375rem', fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  checkboxLabel: {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    fontSize: '0.875rem', fontWeight: 500,
    color: 'var(--color-text-primary)', cursor: 'pointer',
  },
  checkbox: { width: '1rem', height: '1rem', cursor: 'pointer' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' },
  cancelButton: {
    padding: '0.4rem 0.875rem', backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
    borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
  },
  saveButton: {
    padding: '0.4rem 0.875rem', backgroundColor: '#3b82f6',
    color: 'white', border: 'none', borderRadius: '0.375rem',
    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
  },

  // Table
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  th: {
    padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '2px solid #e5e7eb', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap',
  },
  thCenter: {
    padding: '0.5rem 0.75rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '2px solid #e5e7eb', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap',
  },
  trEven: { backgroundColor: 'var(--color-bg-primary)' },
  trOdd: { backgroundColor: '#f9fafb' },
  tdRc: {
    padding: '0.625rem 0.75rem', fontSize: '0.8rem',
    color: 'var(--color-text-primary)', maxWidth: '180px',
  },
  tdDate: {
    padding: '0.625rem 0.75rem', fontSize: '0.8rem',
    color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
  },
  tdCenter: {
    padding: '0.625rem 0.75rem', fontSize: '1rem',
    textAlign: 'center', color: '#10b981',
  },
  tdAction: {
    padding: '0.625rem 0.75rem', fontSize: '0.875rem',
    color: 'var(--color-text-primary)', fontWeight: 500,
  },
  tdResponse: {
    padding: '0.625rem 0.75rem', fontSize: '0.8rem',
    color: 'var(--color-text-secondary)', fontStyle: 'italic',
  },
  tdResponsible: {
    padding: '0.625rem 0.75rem', fontSize: '0.8rem',
    color: 'var(--color-text-primary)', whiteSpace: 'nowrap',
  },
  tdButtons: {
    padding: '0.625rem 0.75rem', whiteSpace: 'nowrap',
  },
  rcInlineBadge: {
    display: 'inline-block', padding: '0.125rem 0.375rem',
    backgroundColor: '#ede9fe', color: '#6d28d9',
    fontSize: '0.75rem', borderRadius: '0.25rem', fontWeight: 500, cursor: 'default',
  },
  ongoingDot: { color: '#3b82f6', fontWeight: 700 },
  editButton: {
    padding: '0.2rem 0.5rem', backgroundColor: '#3b82f6',
    color: 'white', border: 'none', borderRadius: '0.25rem',
    fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', marginRight: '0.25rem',
  },
  deleteButton: {
    padding: '0.2rem 0.5rem', backgroundColor: '#ef4444',
    color: 'white', border: 'none', borderRadius: '0.25rem',
    fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
  },
  emptyRc: {
    padding: '0.75rem 1rem', fontSize: '0.8rem',
    color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: 0,
  },
};
