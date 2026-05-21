// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/StepNavigation.tsx
import React from 'react';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
  onSubmit?: () => void;
  isSaving: boolean;
  isLastStep: boolean;
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  canGoNext,
  canGoPrevious,
  onPrevious,
  onNext,
  onSave,
  onSubmit,
  isSaving,
  isLastStep,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.leftSection}>
        {canGoPrevious && (
          <button onClick={onPrevious} style={styles.secondaryButton} disabled={isSaving}>
            <svg style={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
        )}
      </div>

      <div style={styles.centerSection}>
        <span style={styles.stepIndicator}>
          Step {currentStep} of {totalSteps}
        </span>
      </div>

      <div style={styles.rightSection}>
        <button onClick={onSave} style={styles.saveButton} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Draft'}
        </button>

        {isLastStep && onSubmit ? (
          <button
            onClick={onSubmit}
            style={styles.submitButton}
            disabled={!canGoNext || isSaving}
          >
            Submit for Approval
          </button>
        ) : (
          <button
            onClick={onNext}
            style={styles.primaryButton}
            disabled={!canGoNext || isSaving}
          >
            Next
            <svg style={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '0.5rem',
    marginTop: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  leftSection: {
    flex: 1,
    display: 'flex',
    justifyContent: 'flex-start',
  },
  centerSection: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  rightSection: {
    flex: 1,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
  stepIndicator: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  saveButton: {
    padding: '0.625rem 1.25rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  submitButton: {
    padding: '0.625rem 1.25rem',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonIcon: {
    width: '1rem',
    height: '1rem',
  },
};