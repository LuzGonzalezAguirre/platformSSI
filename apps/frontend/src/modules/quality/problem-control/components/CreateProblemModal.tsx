/**
 * Create Problem Modal - Form to create new problem
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateProblem } from '../hooks/useProblemQueries';
import { ProblemSeverity, ProblemCreateData } from '../types/problem.types';
import { useTranslation } from 'react-i18next';

interface CreateProblemModalProps {
  onClose: () => void;
}

export function CreateProblemModal({ onClose }: CreateProblemModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateProblem();
  
  const [formData, setFormData] = useState<ProblemCreateData>({
    customer_name: '',
    part_number: '',
    description: '',
    severity: ProblemSeverity.MEDIUM,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.customer_name.trim()) {
      newErrors.customer_name = t('problemControl.validation.customerRequired');
    }
    
    if (!formData.description.trim()) {
      newErrors.description = t('problemControl.validation.descriptionRequired');
    }
    
    if (formData.description.length < 20) {
      newErrors.description = t('problemControl.validation.descriptionTooShort');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    try {
      const problem = await createMutation.mutateAsync(formData);
      navigate(`/quality/problems/${problem.id}`);
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || t('common.error'));
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('problemControl.createNew')}</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Customer Name */}
            <div className="form-group">
              <label>
                {t('problemControl.customer')} <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`form-control ${errors.customer_name ? 'is-invalid' : ''}`}
                value={formData.customer_name}
                onChange={(e) =>
                  setFormData({ ...formData, customer_name: e.target.value })
                }
                placeholder={t('problemControl.customerPlaceholder')}
              />
              {errors.customer_name && (
                <div className="invalid-feedback">{errors.customer_name}</div>
              )}
            </div>
            
            {/* Part Number */}
            <div className="form-group">
              <label>{t('problemControl.partNumber')}</label>
              <input
                type="text"
                className="form-control"
                value={formData.part_number}
                onChange={(e) =>
                  setFormData({ ...formData, part_number: e.target.value })
                }
                placeholder={t('problemControl.partNumberPlaceholder')}
              />
            </div>
            
            {/* Severity */}
            <div className="form-group">
              <label>
                {t('problemControl.severity.label')} <span className="required">*</span>
              </label>
              <select
                className="form-control"
                value={formData.severity}
                onChange={(e) =>
                  setFormData({ ...formData, severity: e.target.value as ProblemSeverity })
                }
              >
                <option value={ProblemSeverity.LOW}>
                  {t('problemControl.severity.low')}
                </option>
                <option value={ProblemSeverity.MEDIUM}>
                  {t('problemControl.severity.medium')}
                </option>
                <option value={ProblemSeverity.HIGH}>
                  {t('problemControl.severity.high')}
                </option>
                <option value={ProblemSeverity.CRITICAL}>
                  {t('problemControl.severity.critical')}
                </option>
              </select>
            </div>
            
            {/* Description */}
            <div className="form-group">
              <label>
                {t('problemControl.description')} <span className="required">*</span>
              </label>
              <textarea
                className={`form-control ${errors.description ? 'is-invalid' : ''}`}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={6}
                placeholder={t('problemControl.descriptionPlaceholder')}
              />
              <small className="form-text text-muted">
                {formData.description.length} / 20 {t('common.charactersMin')}
              </small>
              {errors.description && (
                <div className="invalid-feedback">{errors.description}</div>
              )}
            </div>
          </div>
          
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              {t('common.cancel')}
            </button>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? t('common.creating')
                : t('problemControl.createDraft')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}