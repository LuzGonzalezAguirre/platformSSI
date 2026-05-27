// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/Step3b_Containment.tsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWizardStore } from '../../store/wizardStore';
import { useQualityUsers } from '../../hooks/useCatalogs';
import {
  useContainmentActions,
  useContainmentActionCreate,
  useContainmentActionUpdate,
  useContainmentActionDelete,
} from '../../hooks/useContainmentActions';
import type { ContainmentAction } from '../../types/problem.types';
import { StepMediaBar } from '../shared/StepMediaBar';

export const Step3b_Containment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;

  const setStepValidation = useWizardStore((s) => s.setStepValidation);
  const { data: qualityUsers } = useQualityUsers();
  const { data: actions, isLoading } = useContainmentActions(problemId);

  const createMutation = useContainmentActionCreate();
  const updateMutation = useContainmentActionUpdate();
  const deleteMutation = useContainmentActionDelete();

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<ContainmentAction>>({
    action: '',
    response: '',
    responsible: undefined,
    due_date: '',
    completion_date: '',
    ongoing: false,
  });

  // Step 3b es opcional — siempre válido
  useEffect(() => {
    setStepValidation(4, true);
  }, [setStepValidation]);

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({
      action: '',
      response: '',
      responsible: undefined,
      due_date: '',
      completion_date: '',
      ongoing: false,
    });
  };

  const handleEdit = (action: ContainmentAction) => {
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

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      action: '',
      response: '',
      responsible: undefined,
      due_date: '',
      completion_date: '',
      ongoing: false,
    });
  };

  const handleSave = async () => {
    if (!problemId) {
      alert('Please save the problem first before adding containment actions.');
      return;
    }

    if (!formData.action?.trim()) {
      alert('Action description is required.');
      return;
    }

    try {
      if (editingId) {
        // Update existing
        await updateMutation.mutateAsync({
          id: editingId,
          data: {
            action: formData.action,
            response: formData.response,
            ongoing: formData.ongoing,
            due_date: formData.due_date || undefined,
            completion_date: formData.completion_date || undefined,
            responsible_id: formData.responsible?.id,
          },
        });
      } else {
        // Create new
        await createMutation.mutateAsync({
          problem: problemId,
          action: formData.action!,
          response: formData.response,
          responsible_id: formData.responsible?.id,
          due_date: formData.due_date || undefined,
          completion_date: formData.completion_date || undefined,
          ongoing: formData.ongoing,
        } as any);
      }

      handleCancel();
    } catch (error: any) {
      alert(`Error saving action: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDelete = async (actionId: number) => {
    if (!window.confirm('Delete this containment action?')) return;

    try {
      await deleteMutation.mutateAsync({ id: actionId, problemId: problemId! });
    } catch (error: any) {
      alert(`Error deleting action: ${error.response?.data?.detail || error.message}`);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>D3 — Containment Actions</h2>
      <p style={styles.description}>
        Define interim containment actions to isolate the problem and protect the customer.
      </p>

      {/* Action Button */}
      {!isAdding && !editingId && (
        <button onClick={handleAdd} style={styles.addButton} disabled={!problemId}>
          <svg style={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Containment Action
        </button>
      )}

      {!problemId && (
        <div style={styles.warningBox}>
          Please save the problem first before adding containment actions.
        </div>
      )}

      {/* Form */}
      {(isAdding || editingId) && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>
            {editingId ? 'Edit Containment Action' : 'New Containment Action'}
          </h3>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Action Description <span style={styles.required}>*</span>
            </label>
            <textarea
              value={formData.action || ''}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              placeholder="Describe the containment action..."
              rows={3}
              style={styles.textarea}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Response / Notes</label>
            <textarea
              value={formData.response || ''}
              onChange={(e) => setFormData({ ...formData, response: e.target.value })}
              placeholder="Action results, notes, or additional details..."
              rows={2}
              style={styles.textarea}
            />
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
                {Array.isArray(qualityUsers) && qualityUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Due Date</label>
              <input
                type="date"
                value={formData.due_date || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Completion Date</label>
              <input
                type="date"
                value={formData.completion_date || ''}
                onChange={(e) => setFormData({ ...formData, completion_date: e.target.value })}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.ongoing || false}
                onChange={(e) => setFormData({ ...formData, ongoing: e.target.checked })}
                style={styles.checkbox}
              />
              <span>Ongoing Action</span>
            </label>
          </div>

          <div style={styles.formActions}>
            <button onClick={handleCancel} style={styles.cancelButton} disabled={isSaving}>
              Cancel
            </button>
            <button onClick={handleSave} style={styles.saveButton} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={styles.tableContainer}>
        {isLoading ? (
          <p style={styles.loadingText}>Loading actions...</p>
        ) : !actions || actions.length === 0 ? (
          <p style={styles.emptyText}>No containment actions added yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Responsible</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Completed</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.actionText}>{action.action}</div>
                    {action.response && (
                      <div style={styles.responseText}>{action.response}</div>
                    )}
                  </td>
                  <td style={styles.td}>
                    {action.responsible
                      ? `${action.responsible.first_name} ${action.responsible.last_name}`
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    {action.due_date
                      ? new Date(action.due_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    {action.completion_date
                      ? new Date(action.completion_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    {action.completion_date ? (
                      <span style={styles.completedBadge}>Completed</span>
                    ) : action.ongoing ? (
                      <span style={styles.ongoingBadge}>Ongoing</span>
                    ) : (
                      <span style={styles.pendingBadge}>Pending</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionButtons}>
                      <button
                        onClick={() => handleEdit(action)}
                        style={styles.editButton}
                        disabled={isSaving}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(action.id)}
                        style={styles.deleteButton}
                        disabled={isSaving}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {problemId && <StepMediaBar problemId={problemId} step="step3b" />}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: '0.5rem',
  },
  description: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  warningBox: {
    padding: '1rem',
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '0.5rem',
    color: '#92400e',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '1.5rem',
  },
  buttonIcon: {
    width: '1rem',
    height: '1rem',
  },
  formCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-secondary)',
    border: '2px solid #3b82f6',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
  },
  formTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: '1rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginBottom: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: '0.25rem',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
  },
  textarea: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    resize: 'vertical',
  },
  select: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  checkboxGroup: {
    marginBottom: '1rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  checkbox: {
    width: '1rem',
    height: '1rem',
    cursor: 'pointer',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
  cancelButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  saveButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tableContainer: {
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  loadingText: {
    textAlign: 'center',
    padding: '2rem',
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
  },
  emptyText: {
    textAlign: 'center',
    padding: '2rem',
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '0.75rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    borderBottom: '2px solid var(--color-border)',
    backgroundColor: '#f9fafb',
  },
  tr: {
    borderBottom: '1px solid var(--color-border)',
  },
  td: {
    padding: '0.75rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
  },
  actionText: {
    fontWeight: 500,
    marginBottom: '0.25rem',
  },
  responseText: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
  },
  completedBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#10b981',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: '0.25rem',
  },
  ongoingBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: '0.25rem',
  },
  pendingBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#f59e0b',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: '0.25rem',
  },
  actionButtons: {
    display: 'flex',
    gap: '0.5rem',
  },
  editButton: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
};