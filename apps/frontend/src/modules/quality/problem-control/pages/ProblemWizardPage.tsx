// apps/frontend/src/modules/quality/problem-control/pages/ProblemWizardPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
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
      3: fail('Save the problem, then add containment actions'),
      4: fail('No Five Why analysis saved yet'),
      5: fail('No corrective actions saved yet'),
      6: fail('No verification evidence saved yet'),
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

  const d3 = (problem.containment_actions?.length ?? 0) > 0;

  const requiredCategories = ['made', 'escape', 'systemic'];
  const d4 = requiredCategories.every((category) =>
    problem.five_why_analyses?.some((analysis) =>
      analysis.category === category &&
      analysis.root_causes?.some((rootCause) =>
        rootCause.why1?.trim() && rootCause.why2?.trim() && rootCause.why3?.trim()
      )
    )
  );

  const d5 = (problem.corrective_actions?.length ?? 0) > 0;
  const d6 = d5 && problem.corrective_actions.every((action) =>
    problem.attachments?.some((attachment) =>
      attachment.step === 'step6' && attachment.corrective_action_id === action.id
    )
  );
  const d7 = (problem.prevention_actions?.length ?? 0) > 0;

  return {
    1: d1 ? ok : fail('D1: Brief description, full description, type, severity, champion and date are required'),
    2: ok,
    3: d3 ? ok : fail('D3: Add at least one containment action'),
    4: d4 ? ok : fail('D4: Complete Why 1, Why 2 and Why 3 in Made, Escape and Systemic'),
    5: d5 ? ok : fail('D5: Add at least one corrective action'),
    6: d6 ? ok : fail('D6: Upload test evidence for every D5 corrective action'),
    7: d7 ? ok : fail('D7: Add at least one prevention action'),
    8: ok,
  };
}

export const ProblemWizardPage: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { formData, updateFormData, resetFormData, setCurrentStep } = useWizardStore();

  const { data: problem, isLoading: isLoadingProblem } = useProblemDetail(
    isEditMode ? Number(id) : undefined
  );

  const stepValidation = useMemo(() => getStepValidation(problem), [problem]);
  const canSubmit = useMemo(
    () => Object.values(stepValidation).every(v => v.valid),
    [stepValidation]
  );

  const createMutation = useProblemCreate();
  const updateMutation = useProblemUpdate();
  const submitMutation = useProblemSubmit();

  useEffect(() => {
    if (isEditMode && problem) {
      updateFormData(problem);
    }
  }, [isEditMode, problem, updateFormData]);

  useEffect(() => {
    return () => {
      resetFormData();
      setCurrentStep(1);
    };
  }, [resetFormData, setCurrentStep]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const showNotification = (
    type: 'success' | 'error' | 'info',
    title: string,
    message: string
  ) => {
    setNotification({ type, title, message });
  };

  const handleSave = async () => {
    try {
      if (isEditMode && id) {
        await updateMutation.mutateAsync({
          id: Number(id),
          data: {
            ...formData,
            team_member_ids: formData.team_members?.map((m) => m.id),
            manufacturing_approver_id: formData.manufacturing_approver?.id || null,
            production_approver_id: formData.production_approver?.id || null,
            maintenance_approver_id: formData.maintenance_approver?.id || null,
          },
        });

        showNotification(
          'success',
          'Changes saved',
          'The 8D problem was saved successfully.'
        );
      } else {
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
          team_member_ids: formData.team_members?.map((m) => m.id),
        };

        const newProblem = await createMutation.mutateAsync(createData);

        showNotification(
          'success',
          'Problem created',
          'The new 8D problem was created successfully.'
        );

        navigate(`/quality/problems/${newProblem.id}/edit`, { replace: true });
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.message || 'Unable to save the problem.';
      showNotification('error', 'Save failed', detail);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('Submit this problem for approval? You will not be able to edit it after submission.')) {
      return;
    }

    try {
      if (!isEditMode || !id) {
        showNotification('info', 'Save required', 'Please save the problem before submitting it.');
        return;
      }

      await submitMutation.mutateAsync(Number(id));
      showNotification('success', 'Submitted', 'The problem was submitted for approval successfully.');
      window.setTimeout(() => navigate('/quality/problems'), 500);
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.message || 'Unable to submit the problem.';
      showNotification('error', 'Submit failed', detail);
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
      {notification && (
        <div
          role="status"
          style={{
            ...styles.notification,
            ...(notification.type === 'success'
              ? styles.notificationSuccess
              : notification.type === 'error'
                ? styles.notificationError
                : styles.notificationInfo),
          }}
        >
          <div
            style={{
              ...styles.notificationIcon,
              ...(notification.type === 'success'
                ? styles.notificationIconSuccess
                : notification.type === 'error'
                  ? styles.notificationIconError
                  : styles.notificationIconInfo),
            }}
          >
            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '!' : 'i'}
          </div>
          <div style={styles.notificationText}>
            <div style={styles.notificationTitle}>{notification.title}</div>
            <div style={styles.notificationMessage}>{notification.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={styles.notificationClose}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

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
    position: 'relative',
  },
  loadingContainer: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  notification: {
    position: 'fixed',
    top: '1.25rem',
    right: '1.25rem',
    zIndex: 9999,
    minWidth: '320px',
    maxWidth: '430px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.9rem 1rem',
    borderRadius: '0.65rem',
    border: '1px solid var(--color-border)',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
    backgroundColor: 'var(--color-bg-secondary)',
  },
  notificationSuccess: {
    borderLeft: '4px solid #16a34a',
  },
  notificationError: {
    borderLeft: '4px solid #dc2626',
  },
  notificationInfo: {
    borderLeft: '4px solid #2563eb',
  },
  notificationIcon: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 800,
    flexShrink: 0,
  },
  notificationIconSuccess: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  notificationIconError: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  notificationIconInfo: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
  },
  notificationText: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    fontWeight: 700,
    marginBottom: '0.15rem',
  },
  notificationMessage: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.78rem',
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },
  notificationClose: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontSize: '1.2rem',
    lineHeight: 1,
    padding: 0,
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