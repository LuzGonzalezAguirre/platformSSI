// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/Step3a_InitialResponse.tsx

import React, { useEffect } from 'react';
import { useWizardStore } from '../../store/wizardStore';

export const Step3a_InitialResponse: React.FC = () => {
  const { formData, updateFormData, setStepValidation } = useWizardStore();

  // Validación: D3 fields son opcionales
  useEffect(() => {
    setStepValidation(3, true);
  }, [setStepValidation]);

  const handleChange = (field: string, value: any) => {
    updateFormData({ [field]: value });
  };

  // Calcular initial_response_due (created_at + 48 horas)
  const initialResponseDue = formData.created_at
    ? new Date(new Date(formData.created_at).getTime() + 48 * 60 * 60 * 1000)
    : null;

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>Step 3a - Initial Response (D3)</h2>
      <p style={styles.description}>
        Provide immediate containment actions and initial response within 48 hours of problem occurrence.
      </p>

      {/* Due Date Info */}
      {initialResponseDue && (
        <div style={styles.infoBox}>
          <div style={styles.infoLabel}>Initial Response Due:</div>
          <div style={styles.infoDue}>
            {initialResponseDue.toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div style={styles.infoSubtext}>
            (48 hours from occurrence date)
          </div>
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.subsectionTitle}>Initial Response</h3>

        <div style={styles.formGroup}>
          <label style={styles.label}>Initial Response Actions</label>
          <textarea
            value={formData.d3_initial_response || ''}
            onChange={(e) => handleChange('d3_initial_response', e.target.value)}
            placeholder="Describe the immediate actions taken to contain the problem..."
            rows={6}
            style={styles.textarea}
          />
          <div style={styles.helperText}>
            Include immediate containment, notifications sent, and any temporary fixes applied.
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Tracking Information</label>
          <textarea
            value={formData.d3_tracking_info || ''}
            onChange={(e) => handleChange('d3_tracking_info', e.target.value)}
            placeholder="Reference numbers, batch IDs, work orders, or other tracking information..."
            rows={4}
            style={styles.textarea}
          />
          <div style={styles.helperText}>
            Include any relevant tracking numbers, lot codes, or reference IDs.
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>D3 Completion Date</label>
            <input
              type="date"
              value={formData.d3_completed_date || ''}
              onChange={(e) => handleChange('d3_completed_date', e.target.value)}
              style={styles.input}
            />
            <div style={styles.helperText}>
              Date when initial response was completed
            </div>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div style={styles.summaryBox}>
        <h4 style={styles.summaryTitle}>D3 Summary</h4>
        <div style={styles.summaryContent}>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Status:</span>
            <span style={styles.summaryValue}>
              {formData.d3_completed_date ? (
                <span style={styles.completedBadge}>Completed</span>
              ) : (
                <span style={styles.pendingBadge}>Pending</span>
              )}
            </span>
          </div>
          {formData.d3_completed_date && (
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Completed:</span>
              <span style={styles.summaryValue}>
                {new Date(formData.d3_completed_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
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
  infoBox: {
    padding: '1rem',
    backgroundColor: '#eff6ff',
    border: '1px solid #3b82f6',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
  },
  infoLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#1e40af',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  },
  infoDue: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#1e3a8a',
  },
  infoSubtext: {
    fontSize: '0.75rem',
    color: '#3b82f6',
    marginTop: '0.25rem',
  },
  section: {
    marginBottom: '2rem',
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '0.5rem',
  },
  subsectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: '1rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
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
  helperText: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    marginTop: '0.25rem',
  },
  summaryBox: {
    padding: '1rem',
    backgroundColor: '#f9fafb',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
  },
  summaryTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: '0.75rem',
  },
  summaryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
  },
  summaryValue: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
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
  pendingBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#f59e0b',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: '0.25rem',
  },
};