// apps/frontend/src/modules/quality/problem-control/store/wizardStore.ts
import { create } from 'zustand';
import type { Problem } from '../types/problem.types';

interface WizardState {
  // Current step (1-8)
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Form data (partial problem)
  formData: Partial<Problem>;
  updateFormData: (data: Partial<Problem>) => void;
  resetFormData: () => void;

  // Validation state
  stepValidations: { [key: number]: boolean };
  setStepValidation: (step: number, isValid: boolean) => void;

  // Dirty state (unsaved changes)
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  currentStep: 1,
  setCurrentStep: (step) => set({ currentStep: step }),

  formData: {},
  updateFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
      isDirty: true,
    })),
  resetFormData: () => set({ formData: {}, isDirty: false }),

  stepValidations: {},
  setStepValidation: (step, isValid) =>
    set((state) => ({
      stepValidations: { ...state.stepValidations, [step]: isValid },
    })),

  isDirty: false,
  setIsDirty: (dirty) => set({ isDirty: dirty }),
}));