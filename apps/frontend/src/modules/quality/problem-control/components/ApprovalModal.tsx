/**
 * Approval Modal - For managers to approve/reject problems
 */
import React, { useState } from 'react';
import { ProblemDetail } from '../types/problem.types';
import { useApproveProblem, useRejectProblem } from '../hooks/useProblemQueries';
import { useTranslation } from 'react-i18next';

interface ApprovalModalProps {
  problem: ProblemDetail;
  onClose: () => void;
}

export function ApprovalModal({ problem, onClose }: ApprovalModalProps) {
  const { t } = useTranslation();
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const approveMutation = useApproveProblem();
  const rejectMutation = useRejectProblem();
  
  const handleApprove = async () => {
    if (confirm(t('problemControl.confirmApprove'))) {
      try {
        await approveMutation.mutateAsync(problem.id);
        onClose();
      } catch (error: any) {
        alert(error.response?.data?.error || t('common.error'));
      }
    }
  };
  
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert(t('problemControl.rejectionReasonRequired'));
      return;
    }
    
    if (confirm(t('problemControl.confirmReject'))) {
      try {
        await rejectMutation.mutateAsync({
          problemId: problem.id,
          reason: rejectionReason,
        });
        onClose();
      } catch (error: any) {
        alert(error.response?.data?.error || t('common.error'));
      }
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('problemControl.reviewProblem')}</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          {/* Problem Summary */}
          <div className="problem-summary">
            <h3>{t('problemControl.problemSummary')}</h3>
            <div className="summary-grid">
              <div>
                <label>{t('problemControl.customer')}</label>
                <p>{problem.customer_name}</p>
              </div>
              <div>
                <label>{t('problemControl.severity.label')}</label>
                <p>{problem.severity}</p>
              </div>
              <div>
                <label>{t('problemControl.createdBy')}</label>
                <p>{problem.created_by_detail.full_name}</p>
              </div>
              <div>
                <label>{t('problemControl.createdAt')}</label>
                <p>{new Date(problem.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="description-box">
              <label>{t('problemControl.description')}</label>
              <p>{problem.description}</p>
            </div>
          </div>
          
          {/* Action Selection */}
          {!action && (
            <div className="action-buttons">
              <button
                className="btn btn-success btn-lg"
                onClick={() => setAction('approve')}
              >
                {t('problemControl.approveProblem')}
              </button>
              
              <button
                className="btn btn-danger btn-lg"
                onClick={() => setAction('reject')}
              >
                {t('problemControl.rejectProblem')}
              </button>
            </div>
          )}
          
          {/* Approval Confirmation */}
          {action === 'approve' && (
            <div className="approval-section">
              <div className="alert alert-success">
                <h4>{t('problemControl.approvalConfirmation')}</h4>
                <p>{t('problemControl.approvalMessage')}</p>
                <ul>
                  <li>{t('problemControl.approvalEffect1')}</li>
                  <li>{t('problemControl.approvalEffect2')}</li>
                  <li>{t('problemControl.approvalEffect3')}</li>
                </ul>
              </div>
              
              <div className="action-buttons">
                <button
                  className="btn btn-secondary"
                  onClick={() => setAction(null)}
                >
                  {t('common.cancel')}
                </button>
                
                <button
                  className="btn btn-success"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending
                    ? t('common.processing')
                    : t('problemControl.confirmApprove')}
                </button>
              </div>
            </div>
          )}
          
          {/* Rejection Form */}
          {action === 'reject' && (
            <div className="rejection-section">
              <div className="alert alert-warning">
                <h4>{t('problemControl.rejectionWarning')}</h4>
                <p>{t('problemControl.rejectionMessage')}</p>
              </div>
              
              <div className="form-group">
                <label>
                  {t('problemControl.rejectionReason')} <span className="required">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder={t('problemControl.rejectionReasonPlaceholder')}
                  className="form-control"
                  required
                />
              </div>
              
              <div className="action-buttons">
                <button
                  className="btn btn-secondary"
                  onClick={() => setAction(null)}
                >
                  {t('common.cancel')}
                </button>
                
                <button
                  className="btn btn-danger"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending || !rejectionReason.trim()}
                >
                  {rejectMutation.isPending
                    ? t('common.processing')
                    : t('problemControl.confirmReject')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}