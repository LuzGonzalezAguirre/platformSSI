// apps/frontend/src/modules/quality/problem-control/components/ProblemWizard/Step1_DefineProblem.tsx
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWizardStore } from '../../store/wizardStore';
import { useSeverityLevels, useDefectTypes, useQualityUsers } from '../../hooks/useCatalogs';
import type { ProblemCategory, ProblemType, SeverityContext, ShiftType } from '../../types/problem.types';
import { StepMediaBar } from '../shared/StepMediaBar';

export const Step1_DefineProblem: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;
  const { formData, updateFormData, setStepValidation } = useWizardStore();

  const { data: severityLevels } = useSeverityLevels();
  const { data: defectTypes } = useDefectTypes();
  const { data: qualityUsers } = useQualityUsers();

  // Validate step whenever form data changes
  useEffect(() => {
    const isValid = !!(
      formData.brief_description &&
      formData.full_description &&
      formData.problem_type &&
      formData.severity_level_data?.id &&
      formData.champion?.id &&
      formData.date_of_occurrence
    );
    setStepValidation(1, isValid);
  }, [formData, setStepValidation]);

  const handleChange = (field: string, value: any) => {
    updateFormData({ [field]: value });
  };

  const categoryOptions: { value: ProblemCategory; label: string }[] = [
    { value: '', label: 'No Value Selected' },
    { value: '3rd_party_audit', label: '3rd Party Quality Systems Audit' },
    { value: 'continuous_improvement', label: 'Continuous Improvement' },
    { value: 'customer', label: 'Customer' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'environmental', label: 'Environmental' },
    { value: 'internal', label: 'Internal' },
    { value: 'internal_audit', label: 'Internal Quality Audit' },
    { value: 'preventive', label: 'Preventive' },
    { value: 'safety', label: 'Safety' },
    { value: 'supplier', label: 'Supplier' },
  ];

  const problemTypeOptions: { value: ProblemType; label: string }[] = [
    { value: 'cost', label: 'Cost' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'dimensional', label: 'Dimensional' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'functional', label: 'Functional' },
    { value: 'other', label: 'Other' },
    { value: 'packaging', label: 'Packaging/Labeling' },
    { value: 'preventive', label: 'Preventive' },
    { value: 'product_improvement', label: 'Product/Process Improvement' },
  ];

  const severityContextOptions: { value: SeverityContext; label: string }[] = [
    { value: 'customer', label: 'Customer Note' },
    { value: 'internal', label: 'Internal Note' },
    { value: 'supplier', label: 'Supplier Note' },
    { value: 'audit', label: 'Audit Note' },
  ];

  const shiftOptions: { value: ShiftType; label: string }[] = [
    { value: '', label: 'No Value Selected' },
    { value: '1st', label: '1st Shift' },
    { value: '2nd', label: '2nd Shift' },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>D1 — Define the Problem</h2>

      {/* Problem Description */}
      <div style={styles.section}>
        <h3 style={styles.subsectionTitle}>Problem Description</h3>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            Brief Description <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={formData.brief_description || ''}
            onChange={(e) => handleChange('brief_description', e.target.value)}
            placeholder="Short summary of the problem"
            maxLength={500}
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            Full Description <span style={styles.required}>*</span>
          </label>
          <textarea
            value={formData.full_description || ''}
            onChange={(e) => handleChange('full_description', e.target.value)}
            placeholder="Detailed description of the problem"
            rows={4}
            style={styles.textarea}
          />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Category</label>
            <select
              value={formData.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
              style={styles.select}
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Problem Type <span style={styles.required}>*</span>
            </label>
            <select
              value={formData.problem_type || ''}
              onChange={(e) => handleChange('problem_type', e.target.value)}
              style={styles.select}
            >
              <option value="">Select...</option>
              {problemTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          
        </div>
      </div>

      {/* Severity */}
      <div style={styles.section}>
        <h3 style={styles.subsectionTitle}>Severity Assessment</h3>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Severity Level (0-10) <span style={styles.required}>*</span>
            </label>
            <select
              value={formData.severity_level_data?.id || ''}
              onChange={(e) => {
                const level = severityLevels?.find((l) => l.id === parseInt(e.target.value));
                if (level) {
                  updateFormData({ severity_level_data: level });
                }
              }}
              style={styles.select}
            >
              <option value="">Select...</option>
              {Array.isArray(severityLevels) && severityLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  Level {level.level}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Severity Context</label>
            <select
              value={formData.severity_context || 'customer'}
              onChange={(e) => handleChange('severity_context', e.target.value)}
              style={styles.select}
            >
              {severityContextOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formData.severity_level_data && (
          <div style={styles.severityNote}>
            <strong>Note:</strong>{' '}
            {formData.severity_context === 'customer' && formData.severity_level_data.customer_note}
            {formData.severity_context === 'internal' && formData.severity_level_data.internal_note}
            {formData.severity_context === 'supplier' && formData.severity_level_data.supplier_note}
            {formData.severity_context === 'audit' && formData.severity_level_data.audit_note}
          </div>
        )}
      </div>

      {/* Customer Information */}
      <div style={styles.section}>
        <h3 style={styles.subsectionTitle}>Customer Information</h3>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Customer No</label>
            <input
              type="text"
              value={formData.customer_no || ''}
              onChange={(e) => handleChange('customer_no', e.target.value)}
              placeholder="From Plex"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Customer Name</label>
            <input
              type="text"
              value={formData.customer_name || ''}
              onChange={(e) => handleChange('customer_name', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Customer Part No</label>
            <input
              type="text"
              value={formData.customer_part_no || ''}
              onChange={(e) => handleChange('customer_part_no', e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Customer Problem No</label>
            <input
              type="text"
              value={formData.customer_problem_no || ''}
              onChange={(e) => handleChange('customer_problem_no', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Supplier Information */}
      <div style={styles.section}>
        <h3 style={styles.subsectionTitle}>Supplier Information</h3>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Supplier No</label>
            <input
              type="text"
              value={formData.supplier_no || ''}
              onChange={(e) => handleChange('supplier_no', e.target.value)}
              placeholder="From Plex"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Supplier Name</label>
            <input
              type="text"
              value={formData.supplier_name || ''}
              onChange={(e) => handleChange('supplier_name', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Internal Part Information */}
      <div style={styles.section}>
        <h3 style={styles.subsectionTitle}>Internal Part Information</h3>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Part No</label>
            <input
              type="text"
              value={formData.part_no || ''}
              onChange={(e) => handleChange('part_no', e.target.value)}
              placeholder="From Plex"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Part Name</label>
            <input
              type="text"
              value={formData.part_name || ''}
              onChange={(e) => handleChange('part_name', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Department Code</label>
            <input
              type="text"
              value={formData.department_code || ''}
              onChange={(e) => handleChange('department_code', e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Workcenter Code</label>
            <input
              type="text"
              value={formData.workcenter_code || ''}
              onChange={(e) => handleChange('workcenter_code', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Shift</label>
            <select
              value={formData.shift || ''}
              onChange={(e) => handleChange('shift', e.target.value)}
              style={styles.select}
            >
              {shiftOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Defect Type</label>
            <select
              value={formData.defect_type_data?.id || ''}
              onChange={(e) => {
                const defect = defectTypes?.find((d) => d.id === parseInt(e.target.value));
                if (defect) {
                  updateFormData({ defect_type_data: defect });
                }
              }}
              style={styles.select}
            >
              <option value="">Select...</option>
              {Array.isArray(defectTypes) && defectTypes.map((defect) => (
                <option key={defect.id} value={defect.id}>
                  {defect.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Quantity Placed on Hold</label>
            <input
              type="number"
              value={formData.quantity_placed_on_hold || 0}
              onChange={(e) => handleChange('quantity_placed_on_hold', parseInt(e.target.value))}
              min={0}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Quantity Rejected</label>
            <input
              type="number"
              value={formData.quantity_rejected || 0}
              onChange={(e) => handleChange('quantity_rejected', parseInt(e.target.value))}
              min={0}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Dates & Assignment */}
      <div style={styles.section}>
        <h3 style={styles.subsectionTitle}>Dates & Assignment</h3>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Date of Occurrence <span style={styles.required}>*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.date_of_occurrence?.slice(0, 16) || ''}
              onChange={(e) => handleChange('date_of_occurrence', e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Champion <span style={styles.required}>*</span>
            </label>
            <select
              value={formData.champion?.id || ''}
              onChange={(e) => {
                const user = qualityUsers?.find((u) => u.id === parseInt(e.target.value));
                if (user) {
                  updateFormData({ champion: user });
                }
              }}
              style={styles.select}
            >
              <option value="">Select...</option>
              {Array.isArray(qualityUsers) && qualityUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {problemId && <StepMediaBar problemId={problemId} step="step1" />}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: '1.5rem',
  },
  section: {
    marginBottom: '2rem',
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '0.5rem',
  },
  subsectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: '1rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    marginBottom: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: '0.25rem',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
  },
  textarea: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    resize: 'vertical',
  },
  select: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  severityNote: {
    padding: '1rem',
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: '#92400e',
    marginTop: '1rem',
  },
};