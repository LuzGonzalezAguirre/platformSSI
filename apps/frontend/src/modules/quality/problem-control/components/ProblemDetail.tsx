/**
 * Problem Detail - Full view with 8D wizard
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblemDetail, useSubmitProblem, useCloseProblem } from '../hooks/useProblemQueries';
import { StageWizard } from './StageWizard';
import { ApprovalModal } from './ApprovalModal';
import { AuditLogTimeline } from './AuditLogTimeline';
import { ProblemStatus } from '../types/problem.types';
import { useTranslation } from 'react-i18next';

export function ProblemDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  
  const { data: problem, isLoading } = useProblemDetail(id!);
  const submitMutation = useSubmitProblem();
  const closeMutation = useCloseProblem();
  
  if (isLoading) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }
  
  if (!problem) {
    return <div className="error-container">{t('problemControl.notFound')}</div>;
  }
  
  const handleSubmit = async () => {
    if (confirm(t('problemControl.confirmSubmit'))) {
      await submitMutation.mutateAsync(problem.id);
    }
  };
  
  const handleClose = async () => {
    if (confirm(t('problemControl.confirmClose'))) {
      try {
        await closeMutation.mutateAsync(problem.id);
      } catch (error: any) {
        alert(error.response?.data?.error || t('common.error'));
      }
    }
  };
  
  return (
    <div className="problem-detail-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-link"
            onClick={() => navigate('/quality/problems')}
          >
            ← {t('common.back')}
          </button>
          <h1>
            {problem.problem_number || t('problemControl.draft')}
          </h1>
          <p className="text-muted">
            {t('problemControl.createdBy')}: {problem.created_by_detail.full_name} •{' '}
            {new Date(problem.created_at).toLocaleDateString()}
          </p>
        </div>
        
        <div className="header-actions">
          {problem.status === ProblemStatus.DRAFT && (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {t('problemControl.submitForApproval')}
            </button>
          )}
          
          {problem.status === ProblemStatus.PENDING_APPROVAL && (
            <button
              className="btn btn-warning"
              onClick={() => setShowApprovalModal(true)}
            >
              {t('problemControl.review')}
            </button>
          )}
          
          {problem.status === ProblemStatus.APPROVED && (
            <button
              className="btn btn-success"
              onClick={handleClose}
              disabled={closeMutation.isPending}
            >
              {t('problemControl.closeProblem')}
            </button>
          )}
          
          <button
            className="btn btn-secondary"
            onClick={() => setShowAuditLog(!showAuditLog)}
          >
            {t('problemControl.auditLog')}
          </button>
        </div>
      </div>
      
      {/* Problem Info Card */}
      <div className="problem-info-card">
        <div className="info-grid">
          <div className="info-item">
            <label>{t('problemControl.customer')}</label>
            <p>{problem.customer_name}</p>
          </div>
          
          <div className="info-item">
            <label>{t('problemControl.partNumber')}</label>
            <p>{problem.part_number || '—'}</p>
          </div>
          
          <div className="info-item">
            <label>{t('problemControl.severity.label')}</label>
            <p>
              <span className={`badge badge-${problem.severity}`}>
                {t(`problemControl.severity.${problem.severity}`)}
              </span>
            </p>
          </div>
          
          <div className="info-item">
            <label>{t('problemControl.status.label')}</label>
            <p>
              <span className={`badge badge-${problem.status}`}>
                {t(`problemControl.status.${problem.status}`)}
              </span>
            </p>
          </div>
          
          <div className="info-item">
            <label>{t('problemControl.champion')}</label>
            <p>{problem.champion_detail?.full_name || '—'}</p>
          </div>
          
          <div className="info-item">
            <label>{t('problemControl.quality')}</label>
            <p>{problem.quality_detail?.full_name || '—'}</p>
          </div>
          
          <div className="info-item full-width">
            <label>{t('problemControl.description')}</label>
            <p>{problem.description}</p>
          </div>
        </div>
      </div>
      
      {/* 8D Wizard - Only show if approved */}
      {problem.status === ProblemStatus.APPROVED && (
        <div className="wizard-section">
          <h2>{t('problemControl.8dProcess')}</h2>
          <StageWizard problem={problem} />
        </div>
      )}
      
      {/* Audit Log Sidebar */}
      {showAuditLog && (
        <div className="audit-log-sidebar">
          <AuditLogTimeline problemId={problem.id} />
        </div>
      )}
      
      {/* Approval Modal (Manager only) */}
      {showApprovalModal && (
        <ApprovalModal
          problem={problem}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}