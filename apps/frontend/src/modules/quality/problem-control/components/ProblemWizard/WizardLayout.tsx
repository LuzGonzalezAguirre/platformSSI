// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/WizardLayout.tsx
import React from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { HorizontalStepper } from './HorizontalStepper';
import { StepNavigation } from './StepNavigation';
import { Step1_DefineProblem } from './Step1_DefineProblem';
import { Step2_DefineTeam } from './Step2_DefineTeam';
import { Step3a_InitialResponse } from './Step3a_InitialResponse';
import { Step3b_Containment } from './Step3b_Containment';
import { Step4_FiveWhy } from './Step4_FiveWhy';
import { Step5_CorrectiveActions } from './Step5_CorrectiveActions';
import { Step6_Verification } from './Step6_Verification';
import { Step7_Prevention } from './Step7_Prevention';

interface WizardLayoutProps {
  onSave: () => void;
  onSubmit: () => void;
  isSaving: boolean;
}

export const WizardLayout: React.FC<WizardLayoutProps> = ({ onSave, onSubmit, isSaving }) => {
  const { currentStep, setCurrentStep, stepValidations } = useWizardStore();

  const steps = [
    { number: 1, label: 'Define Problem', component: Step1_DefineProblem },
    { number: 2, label: 'Define Team', component: Step2_DefineTeam },
    { number: 3, label: 'Initial Response', component: Step3a_InitialResponse },
    { number: 4, label: 'Containment', component: Step3b_Containment },
    { number: 5, label: 'Five Why', component: Step4_FiveWhy },
    { number: 6, label: 'Corrective Actions', component: Step5_CorrectiveActions },
    { number: 7, label: 'Verification', component: Step6_Verification },
    { number: 8, label: 'Prevention', component: Step7_Prevention },
  ];

  const totalSteps = steps.length;
  const currentStepData = steps[currentStep - 1];
  const StepComponent = currentStepData.component;

  // Determine which steps are completed
  const stepperSteps = steps.map((step) => ({
    number: step.number,
    label: step.label,
    isCompleted: step.number < currentStep,
    isCurrent: step.number === currentStep,
  }));

  const handleStepClick = (stepNumber: number) => {
    // Only allow clicking on completed steps or current step
    if (stepNumber < currentStep || stepNumber === currentStep) {
      setCurrentStep(stepNumber);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const canGoNext = stepValidations[currentStep] !== false;
  const canGoPrevious = currentStep > 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div>
      {/* Stepper */}
      <HorizontalStepper steps={stepperSteps} onStepClick={handleStepClick} />

      {/* Step Content */}
      <div style={styles.contentContainer}>
        <StepComponent />
      </div>

      {/* Navigation */}
      <StepNavigation
        currentStep={currentStep}
        totalSteps={totalSteps}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSave={onSave}
        onSubmit={isLastStep ? onSubmit : undefined}
        isSaving={isSaving}
        isLastStep={isLastStep}
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