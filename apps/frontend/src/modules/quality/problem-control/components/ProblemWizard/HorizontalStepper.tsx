// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/HorizontalStepper.tsx
import React from 'react';

interface Step {
  number: number;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
  hasError: boolean;
}

interface HorizontalStepperProps {
  steps: Step[];
  onStepClick: (stepNumber: number) => void;
}

export const HorizontalStepper: React.FC<HorizontalStepperProps> = ({ steps, onStepClick }) => {
  return (
    <div style={s.container}>
      <div style={s.stepsWrapper}>
        {steps.map((step, index) => {
          const circleStyle = {
            ...s.stepCircle,
            ...(step.isCurrent && !step.hasError ? s.stepCircleCurrent : {}),
            ...(step.isCurrent && step.hasError ? s.stepCircleCurrentError : {}),
            ...(step.isCompleted && !step.hasError ? s.stepCircleCompleted : {}),
            ...(step.isCompleted && step.hasError ? s.stepCircleCompletedError : {}),
          };

          return (
            <React.Fragment key={step.number}>
              <div style={s.stepContainer}>
                <button onClick={() => onStepClick(step.number)} style={circleStyle}>
                  {step.isCompleted && !step.hasError ? (
                    <svg style={s.checkIcon} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : step.hasError ? (
                    <svg style={s.checkIcon} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span style={s.stepNumber}>{step.number}</span>
                  )}
                </button>
                <span style={{
                  ...s.stepLabel,
                  ...(step.hasError ? s.stepLabelError : {}),
                  ...(step.isCurrent ? s.stepLabelCurrent : {}),
                }}>
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div style={{
                  ...s.connector,
                  ...(step.isCompleted && !step.hasError ? s.connectorCompleted : {}),
                  ...(step.isCompleted && step.hasError ? s.connectorError : {}),
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: 'var(--color-bg-secondary)',
    padding: '1.25rem 1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
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
    gap: '0.375rem',
    zIndex: 1,
  },
  stepCircle: {
    width: '2.75rem',
    height: '2.75rem',
    borderRadius: '50%',
    border: '2px solid #d1d5db',
    backgroundColor: 'var(--color-bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    padding: 0,
  },
  stepCircleCurrent: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  stepCircleCurrentError: {
    borderColor: '#f59e0b',
    backgroundColor: '#f59e0b',
    color: 'white',
  },
  stepCircleCompleted: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
    color: 'white',
  },
  stepCircleCompletedError: {
    borderColor: '#ef4444',
    backgroundColor: '#ef4444',
    color: 'white',
  },
  stepNumber: { fontSize: '0.9rem', fontWeight: 600 },
  checkIcon: { width: '1.25rem', height: '1.25rem' },
  stepLabel: {
    fontSize: '0.7rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    maxWidth: '90px',
  },
  stepLabelError: { color: '#ef4444', fontWeight: 600 },
  stepLabelCurrent: { color: 'var(--color-text-primary)', fontWeight: 600 },
  connector: {
    flex: 1,
    height: '2px',
    backgroundColor: '#d1d5db',
    margin: '0 0.375rem',
    marginBottom: '1.75rem',
  },
  connectorCompleted: { backgroundColor: '#10b981' },
  connectorError: { backgroundColor: '#ef4444' },
};
