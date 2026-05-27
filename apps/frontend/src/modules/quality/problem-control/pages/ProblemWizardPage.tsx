// apps/frontend/src/modules/quality/problem-control/pages/ProblemWizardPage.tsx
import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWizardStore } from '../store/wizardStore';
import { WizardLayout } from '../components/ProblemWizard/WizardLayout';
import { useProblemDetail } from '../hooks/useProblemDetail';
import { useProblemCreate, useProblemUpdate, useProblemSubmit } from '../hooks/useProblemMutations';
import type { Problem, ProblemCreateRequest } from '../types/problem.types';

export interface StepError {
  valid: boolean;
  message: string;
}

function getStepValidation(problem: Problem | undefined): Record<number, StepError> {
  const fail = (msg: string): StepError => ({ valid: false, message: msg });
  const ok: StepError = { valid: true, message: '' };

  if (!problem) {
    return {
      1: fail('Complete and save D1 fields first'),
      2: ok,
      3: fail('Save the problem, then add initial response or containment actions'),
      4: fail('No Five Why analysis saved yet'),
      5: fail('No corrective actions saved yet'),
      6: fail('No verification actions saved yet'),
      7: fail('No prevention actions saved yet'),
      8: ok,
    };
  }

  const d1 = !!(
    problem.brief_description?.trim() &&
    problem.full_description?.trim() &&
    problem.problem_type &&
    problem.severity_level_data?.id &&
    problem.champion?.id &&
    problem.date_of_occurrence
  );

  const d3 = !!(
    problem.initial_response?.trim() ||
    (problem.containment_actions?.length ?? 0) > 0
  );

  const d4 =
    (problem.five_why_analyses?.length ?? 0) > 0 &&
    problem.five_why_analyses.some(a => (a.root_causes?.length ?? 0) > 0);

  const d5 = (problem.corrective_actions?.length ?? 0) > 0;
  const d6 = (problem.verification_actions?.length ?? 0) > 0;
  const d7 = (problem.prevention_actions?.length ?? 0) > 0;

  return {
    1: d1 ? ok : fail('D1: Brief description, full description, type, severity, champion and date are required'),
    2: ok,
    3: d3 ? ok : fail('D3: Add an initial response or at least one containment action'),
    4: d4 ? ok : fail('D4: Add a Five Why analysis with at least one root cause'),
    5: d5 ? ok : fail('D5: Add at least one corrective action'),
    6: d6 ? ok : fail('D6: Add at least one verification action'),
    7: d7 ? ok : fail('D7: Add at least one prevention action'),
    8: ok,
  };
}

export const ProblemWizardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { formData, updateFormData, resetFormData, setCurrentStep } = useWizardStore();

  // Fetch existing problem if edit mode
  const { data: problem, isLoading: isLoadingProblem } = useProblemDetail(
    isEditMode ? Number(id) : undefined
  );

  const stepValidation = useMemo(() => getStepValidation(problem), [problem]);
  const canSubmit = useMemo(
    () => Object.values(stepValidation).every(v => v.valid),
    [stepValidation]
  );

  // Mutations
  const createMutation = useProblemCreate();
  const updateMutation = useProblemUpdate();
  const submitMutation = useProblemSubmit();

  // Load problem data into wizard when editing
  useEffect(() => {
    if (isEditMode && problem) {
      updateFormData(problem);
    }
  }, [isEditMode, problem, updateFormData]);

  // Reset wizard when unmounting
  useEffect(() => {
    return () => {
      resetFormData();
      setCurrentStep(1);
    };
  }, [resetFormData, setCurrentStep]);

  const handleSave = async () => {
  try {
    if (isEditMode && id) {
      // Update existing problem
      await updateMutation.mutateAsync({
        id: Number(id),
        data: {
          ...formData,
          team_member_ids: formData.team_members?.map((m) => m.id), // ← AGREGAR
        },
      });
      alert('Problem saved successfully!');
    } else {
      // Create new problem (Draft)
      const createData: ProblemCreateRequest = {
        brief_description: formData.brief_description || '',
        full_description: formData.full_description || '',
        category: formData.category || '',
        problem_type: formData.problem_type!,
        severity_level_id: formData.severity_level_data?.id!,
        severity_context: formData.severity_context || 'customer',
        champion_id: formData.champion?.id!,
        date_of_occurrence: formData.date_of_occurrence || new Date().toISOString(),
        part_no: formData.part_no,
        defect_type_id: formData.defect_type_data?.id,
        customer_no: formData.customer_no,
        supplier_no: formData.supplier_no,
        team_member_ids: formData.team_members?.map((m) => m.id), // ← AGREGAR
      };

      const newProblem = await createMutation.mutateAsync(createData);
      alert('Problem created successfully!');
      
      navigate(`/quality/problems/${newProblem.id}/edit`, { replace: true });
    }
  } catch (error: any) {
    alert(`Error saving problem: ${error.response?.data?.detail || error.message}`);
  }
};

  const handleSubmit = async () => {
    if (!window.confirm('Submit this problem for approval? You will not be able to edit it after submission.')) {
      return;
    }

    try {
      if (!isEditMode || !id) {
        alert('Please save the problem first before submitting.');
        return;
      }

      await submitMutation.mutateAsync(Number(id));
      alert('Problem submitted for approval successfully!');
      navigate('/quality/problems');
    } catch (error: any) {
      alert(`Error submitting problem: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleBack = () => {
    if (window.confirm('Are you sure you want to leave? Unsaved changes will be lost.')) {
      navigate('/quality/problems');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || submitMutation.isPending;

  if (isEditMode && isLoadingProblem) {
    return (
      <div style={styles.loadingContainer}>
        <p>Loading problem...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <button onClick={handleBack} style={styles.backButton}>
            <svg style={styles.backIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to List
          </button>
          <h1 style={styles.title}>
            {isEditMode ? `Edit Problem ${problem?.problem_number || `#${id}`}` : 'Create New Problem'}
          </h1>
          <p style={styles.subtitle}>
            Complete the 8D problem solving methodology step by step
          </p>
        </div>

        {problem?.status && (
          <div style={styles.statusBadge}>
            Status: {problem.status_display}
          </div>
        )}
      </div>

      {/* Wizard */}
      <WizardLayout
        onSave={handleSave}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        canSubmit={canSubmit}
        stepValidation={stepValidation}
      />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '2rem',
  },
  loadingContainer: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    backgroundColor: 'transparent',
    color: '#3b82f6',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '0.5rem',
  },
  backIcon: {
    width: '1.25rem',
    height: '1.25rem',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: '0.25rem',
  },
  subtitle: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
  },
  statusBadge: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
};