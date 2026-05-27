// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/StepNavigation.tsx
import React, { useState } from 'react';

interface IncompleteStep {
  number: number;
  label: string;
  message: string | undefined;
}

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  canGoPrevious: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
  onSubmit?: () => void;
  isSaving: boolean;
  isLastStep: boolean;
  canSubmit: boolean;
  incompleteSteps: IncompleteStep[];
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  canGoPrevious,
  onPrevious,
  onNext,
  onSave,
  onSubmit,
  isSaving,
  isLastStep,
  canSubmit,
  incompleteSteps,
}) => {
  const [showErrors, setShowErrors] = useState(false);

  return (
    <div style={s.wrapper}>
      {/* Incomplete step errors panel */}
      {isLastStep && !canSubmit && showErrors && (
        <div style={s.errorPanel}>
          <div style={s.errorTitle}>Complete the following before submitting:</div>
          <ul style={s.errorList}>
            {incompleteSteps.map(step => (
              <li key={step.number} style={s.errorItem}>
                <span style={s.errorStep}>{step.label}</span>
                {step.message && <span style={s.errorMsg}> — {step.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={s.container}>
        <div style={s.leftSection}>
          {canGoPrevious && (
            <button onClick={onPrevious} style={s.secondaryButton} disabled={isSaving}>
              <svg style={s.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
          )}
        </div>

        <div style={s.centerSection}>
          <span style={s.stepIndicator}>Step {currentStep} of {totalSteps}</span>
        </div>

        <div style={s.rightSection}>
          <button onClick={onSave} style={s.saveButton} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>

          {isLastStep && onSubmit ? (
            <div style={s.submitWrapper}>
              <button
                onClick={canSubmit ? onSubmit : () => setShowErrors(v => !v)}
                style={{ ...s.submitButton, ...(canSubmit ? {} : s.submitBlocked) }}
                disabled={isSaving}
                title={canSubmit ? 'Submit for approval' : 'Some steps are incomplete'}
              >
                {canSubmit ? 'Submit for Approval' : `Submit (${incompleteSteps.length} incomplete)`}
              </button>
            </div>
          ) : (
            !isLastStep && (
              <button onClick={onNext} style={s.primaryButton} disabled={isSaving}>
                Next
                <svg style={s.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  wrapper: { marginTop: '1.5rem' },

  errorPanel: {
    marginBottom: '0.75rem',
    padding: '0.875rem 1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
  },
  errorTitle: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#b91c1c',
    marginBottom: '0.5rem',
  },
  errorList: {
    margin: 0,
    paddingLeft: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  errorItem: { fontSize: '0.8125rem', color: '#7f1d1d' },
  errorStep: { fontWeight: 600 },
  errorMsg: { fontWeight: 400, color: '#991b1b' },

  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
  },
  leftSection: { flex: 1, display: 'flex', justifyContent: 'flex-start' },
  centerSection: { flex: 1, display: 'flex', justifyContent: 'center' },
  rightSection: { flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' },
  submitWrapper: { position: 'relative' },

  stepIndicator: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' },

  icon: { width: '1rem', height: '1rem' },

  primaryButton: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.625rem 1.25rem', backgroundColor: '#3b82f6', color: 'white',
    border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem',
    fontWeight: 500, cursor: 'pointer',
  },
  secondaryButton: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
    borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
  },
  saveButton: {
    padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
    borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
  },
  submitButton: {
    padding: '0.625rem 1.25rem', backgroundColor: '#10b981', color: 'white',
    border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem',
    fontWeight: 600, cursor: 'pointer',
  },
  submitBlocked: {
    backgroundColor: '#f59e0b', cursor: 'pointer',
  },
};
