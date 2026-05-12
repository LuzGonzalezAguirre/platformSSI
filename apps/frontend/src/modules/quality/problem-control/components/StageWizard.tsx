/**
 * Stage Wizard - 8D Stepper with stage forms
 */
import React, { useState } from 'react';
import { ProblemDetail, Stage, StageCode } from '../types/problem.types';
import { useUpdateStage } from '../hooks/useProblemQueries';
import { useTranslation } from 'react-i18next';

interface StageWizardProps {
  problem: ProblemDetail;
}

export function StageWizard({ problem }: StageWizardProps) {
  const { t } = useTranslation();
  const [activeStage, setActiveStage] = useState<StageCode>(StageCode.D1);
  
  const currentStage = problem.stages.find((s) => s.stage_code === activeStage);
  
  if (!currentStage) {
    return <div>{t('problemControl.stageNotFound')}</div>;
  }
  
  return (
    <div className="stage-wizard">
      {/* Stepper Navigation */}
      <div className="stepper-navigation">
        {problem.stages.map((stage) => (
          <div
            key={stage.stage_code}
            className={`stepper-step ${
              stage.stage_code === activeStage ? 'active' : ''
            } ${stage.status === 'completed' ? 'completed' : ''} ${
              stage.is_overdue ? 'overdue' : ''
            }`}
            onClick={() => setActiveStage(stage.stage_code as StageCode)}
          >
            <div className="step-indicator">
              <div className="step-number">{stage.stage_code}</div>
              {stage.status === 'completed' && <span className="checkmark">✓</span>}
              {stage.is_overdue && <span className="alert-icon">!</span>}
            </div>
            <div className="step-label">{stage.stage_name}</div>
            {stage.due_date && (
              <div className="step-due-date">
                {t('problemControl.due')}: {new Date(stage.due_date).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Stage Content */}
      <div className="stage-content">
        <StageForm stage={currentStage} problemId={problem.id} />
      </div>
    </div>
  );
}

// Generic Stage Form (you'll create specific forms for each stage)
function StageForm({ stage, problemId }: { stage: Stage; problemId: string }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(stage.data);
  const updateMutation = useUpdateStage();
  
  const handleSave = async () => {
    await updateMutation.mutateAsync({
      stageId: stage.id,
      data: { data: formData },
    });
  };
  
  const handleComplete = async () => {
    if (confirm(t('problemControl.confirmComplete'))) {
      await updateMutation.mutateAsync({
        stageId: stage.id,
        data: { data: formData, complete: true },
      });
    }
  };
  
  // Override warning
  if (stage.requires_override) {
    return (
      <div className="override-warning">
        <h3>{t('problemControl.overrideRequired')}</h3>
        <p>{t('problemControl.overrideMessage')}</p>
        <OverrideRequestButton stageId={stage.id} />
      </div>
    );
  }
  
  // Stage completed
  if (stage.status === 'completed') {
    return (
      <div className="stage-completed">
        <h3>✓ {t('problemControl.stageCompleted')}</h3>
        <p>
          {t('problemControl.completedBy')}: {stage.completed_by || '—'} •{' '}
          {stage.completed_at && new Date(stage.completed_at).toLocaleString()}
        </p>
        <div className="completed-data">
          <pre>{JSON.stringify(stage.data, null, 2)}</pre>
        </div>
      </div>
    );
  }
  
  // Render specific form based on stage code
  return (
    <div className="stage-form">
      <h3>{stage.stage_name}</h3>
      
      {/* You'll create specific components for each stage */}
      {stage.stage_code === 'D1' && <StageD1Form data={formData} onChange={setFormData} />}
      {stage.stage_code === 'D2' && <StageD2Form data={formData} onChange={setFormData} />}
      {stage.stage_code === 'D3' && <StageD3Form data={formData} onChange={setFormData} />}
      {stage.stage_code === 'D4' && <StageD4Form data={formData} onChange={setFormData} />}
      {stage.stage_code === 'D5' && <StageD5Form data={formData} onChange={setFormData} />}
      {stage.stage_code === 'D6' && <StageD6Form data={formData} onChange={setFormData} />}
      {stage.stage_code === 'D7' && <StageD7Form data={formData} onChange={setFormData} />}
      {stage.stage_code === 'D8' && <StageD8Form data={formData} onChange={setFormData} />}
      
      <div className="form-actions">
        <button
          className="btn btn-secondary"
          onClick={handleSave}
          disabled={updateMutation.isPending || !stage.can_edit}
        >
          {t('common.save')}
        </button>
        
        <button
          className="btn btn-primary"
          onClick={handleComplete}
          disabled={updateMutation.isPending || !stage.can_edit}
        >
          {t('problemControl.completeStage')}
        </button>
      </div>
    </div>
  );
}

// Placeholder stage forms (you'll implement these)
function StageD1Form({ data, onChange }: any) {
  return (
    <div>
      <div className="form-group">
        <label>Problem Statement</label>
        <textarea
          value={data.problem_statement || ''}
          onChange={(e) => onChange({ ...data, problem_statement: e.target.value })}
          rows={4}
        />
      </div>
    </div>
  );
}

function StageD2Form({ data, onChange }: any) {
  return <div><p>Team Definition Form - TO IMPLEMENT</p></div>;
}

function StageD3Form({ data, onChange }: any) {
  return <div><p>Initial Response Form - TO IMPLEMENT</p></div>;
}

function StageD4Form({ data, onChange }: any) {
  return <div><p>Containment Form - TO IMPLEMENT</p></div>;
}

function StageD5Form({ data, onChange }: any) {
  const { t } = useTranslation();
  
  return (
    <div>
      <h4>{t('problemControl.fiveWhy')}</h4>
      {[1, 2, 3, 4, 5].map((num) => (
        <div key={num} className="form-group">
          <label>Why {num}?</label>
          <textarea
            value={data[`why_${num}`] || ''}
            onChange={(e) => onChange({ ...data, [`why_${num}`]: e.target.value })}
            rows={2}
          />
        </div>
      ))}
      
      <div className="form-group">
        <label>{t('problemControl.rootCause')}</label>
        <textarea
          value={data.root_cause || ''}
          onChange={(e) => onChange({ ...data, root_cause: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}

function StageD6Form({ data, onChange }: any) {
  return <div><p>Root Cause Analysis Form - TO IMPLEMENT</p></div>;
}

function StageD7Form({ data, onChange }: any) {
  return <div><p>Corrective Action Form - TO IMPLEMENT</p></div>;
}

function StageD8Form({ data, onChange }: any) {
  return <div><p>Verification Form - TO IMPLEMENT</p></div>;
}

function OverrideRequestButton({ stageId }: { stageId: string }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Implementation of override request modal
  return (
    <button className="btn btn-warning" onClick={() => setShowModal(true)}>
      {t('problemControl.requestOverride')}
    </button>
  );
}