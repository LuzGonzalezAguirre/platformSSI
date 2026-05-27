// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/WizardLayout.tsx
import React from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { HorizontalStepper } from './HorizontalStepper';
import { StepNavigation } from './StepNavigation';
import { Step1_DefineProblem } from './Step1_DefineProblem';
import { Step2_DefineTeam } from './Step2_DefineTeam';
import { Step3_D3 } from './Step3_D3';
import { Step4_FiveWhy } from './Step4_FiveWhy';
import { Step5_CorrectiveActions } from './Step5_CorrectiveActions';
import { Step6_Verification } from './Step6_Verification';
import { Step7_Prevention } from './Step7_Prevention';
import { Step8_D8_Congratulate } from './Step8_D8_Congratulate';
import type { StepError } from '../../pages/ProblemWizardPage';

export interface WizardLayoutProps {
  onSave: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  canSubmit: boolean;
  stepValidation: Record<number, StepError>;
}

const STEPS = [
  { number: 1, label: 'D1 — Define Problem',    component: Step1_DefineProblem },
  { number: 2, label: 'D2 — Define Team',        component: Step2_DefineTeam },
  { number: 3, label: 'D3 — Response & Contain', component: Step3_D3 },
  { number: 4, label: 'D4 — Five Why',           component: Step4_FiveWhy },
  { number: 5, label: 'D5 — Corrective Actions', component: Step5_CorrectiveActions },
  { number: 6, label: 'D6 — Verification',       component: Step6_Verification },
  { number: 7, label: 'D7 — Prevention',         component: Step7_Prevention },
  { number: 8, label: 'D8 — Congratulate Team',  component: Step8_D8_Congratulate },
];

export const WizardLayout: React.FC<WizardLayoutProps> = ({
  onSave, onSubmit, isSaving, canSubmit, stepValidation,
}) => {
  const { currentStep, setCurrentStep } = useWizardStore();

  const totalSteps = STEPS.length;
  const StepComponent = STEPS[currentStep - 1].component;

  const stepperSteps = STEPS.map((step) => ({
    number: step.number,
    label: step.label,
    isCompleted: step.number < currentStep,
    isCurrent: step.number === currentStep,
    hasError: !stepValidation[step.number]?.valid,
  }));

  const incompleteSteps = STEPS
    .filter(s => !stepValidation[s.number]?.valid)
    .map(s => ({ number: s.number, label: s.label, message: stepValidation[s.number]?.message }));

  return (
    <div>
      <HorizontalStepper steps={stepperSteps} onStepClick={setCurrentStep} />

      <div style={styles.contentContainer}>
        <StepComponent />
      </div>

      <StepNavigation
        currentStep={currentStep}
        totalSteps={totalSteps}
        canGoPrevious={currentStep > 1}
        onPrevious={() => setCurrentStep(currentStep - 1)}
        onNext={() => setCurrentStep(currentStep + 1)}
        onSave={onSave}
        onSubmit={currentStep === totalSteps ? onSubmit : undefined}
        isSaving={isSaving}
        isLastStep={currentStep === totalSteps}
        canSubmit={canSubmit}
        incompleteSteps={incompleteSteps}
      />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  contentContainer: {
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    minHeight: '400px',
  },
};
