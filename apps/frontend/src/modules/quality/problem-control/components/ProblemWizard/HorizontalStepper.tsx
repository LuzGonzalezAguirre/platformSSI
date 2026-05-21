// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/HorizontalStepper.tsx
import React from 'react';

interface Step {
  number: number;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface HorizontalStepperProps {
  steps: Step[];
  onStepClick: (stepNumber: number) => void;
}

export const HorizontalStepper: React.FC<HorizontalStepperProps> = ({ steps, onStepClick }) => {
  return (
    <div style={styles.container}>
      <div style={styles.stepsWrapper}>
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            {/* Step Circle */}
            <div style={styles.stepContainer}>
              <button
                onClick={() => onStepClick(step.number)}
                style={{
                  ...styles.stepCircle,
                  ...(step.isCurrent && styles.stepCircleCurrent),
                  ...(step.isCompleted && styles.stepCircleCompleted),
                }}
                disabled={!step.isCompleted && !step.isCurrent}
              >
                {step.isCompleted ? (
                  <svg style={styles.checkIcon} fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span style={styles.stepNumber}>{step.number}</span>
                )}
              </button>
              <span style={styles.stepLabel}>{step.label}</span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                style={{
                  ...styles.connector,
                  ...(step.isCompleted && styles.connectorCompleted),
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: 'var(--color-bg-secondary)',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  stepsWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  stepContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    zIndex: 1,
  },
  stepCircle: {
    width: '3rem',
    height: '3rem',
    borderRadius: '50%',
    border: '2px solid #d1d5db',
    backgroundColor: 'var(--color-bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  stepCircleCurrent: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  stepCircleCompleted: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
    color: 'white',
  },
  stepNumber: {
    fontSize: '1rem',
    fontWeight: 600,
  },
  checkIcon: {
    width: '1.5rem',
    height: '1.5rem',
  },
  stepLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    maxWidth: '100px',
  },
  connector: {
    flex: 1,
    height: '2px',
    backgroundColor: '#d1d5db',
    margin: '0 0.5rem',
    marginBottom: '2rem',
  },
  connectorCompleted: {
    backgroundColor: '#10b981',
  },
};