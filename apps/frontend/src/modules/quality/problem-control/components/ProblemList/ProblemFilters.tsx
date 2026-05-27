// apps/frontend/src/modules/quality/problem-control/components/ProblemList/ProblemFilters.tsx
import React, { useState } from 'react';
import type { ProblemFilters as Filters, ProblemStatus, ProblemCategory } from '../../types/problem.types';
import { useQualityUsers, useSeverityLevels } from '../../hooks/useCatalogs';

interface ProblemFiltersProps {
  onFilterChange: (filters: Filters) => void;
}

export const ProblemFilters: React.FC<ProblemFiltersProps> = ({ onFilterChange }) => {
  const [filters, setFilters] = useState<Filters>({});
  
  const { data: qualityUsers, isLoading: isLoadingUsers } = useQualityUsers();
  const { data: severityLevels, isLoading: isLoadingSeverity } = useSeverityLevels();

  const handleChange = (key: keyof Filters, value: any) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClear = () => {
    setFilters({});
    onFilterChange({});
  };

  const statusOptions: { value: ProblemStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'pending_approval', label: 'Pending Approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'closed', label: 'Closed' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const categoryOptions: { value: ProblemCategory; label: string }[] = [
    { value: 'customer', label: 'Customer' },
    { value: 'internal', label: 'Internal' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'continuous_improvement', label: 'Continuous Improvement' },
    { value: 'preventive', label: 'Preventive' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {/* Status Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Status</label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleChange('status', e.target.value as ProblemStatus)}
            style={styles.select}
          >
            <option value="">All</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Category</label>
          <select
            value={filters.category || ''}
            onChange={(e) => handleChange('category', e.target.value as ProblemCategory)}
            style={styles.select}
          >
            <option value="">All</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Severity</label>
          <select
            value={filters.severity_level || ''}
            onChange={(e) => handleChange('severity_level', parseInt(e.target.value))}
            style={styles.select}
            disabled={isLoadingSeverity}
          >
            <option value="">All</option>
            {Array.isArray(severityLevels) && severityLevels.map((level) => (
              <option key={level.id} value={level.level}>
                Level {level.level}
              </option>
            ))}
          </select>
        </div>

        {/* Champion Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Champion</label>
          <select
            value={filters.champion_id || ''}
            onChange={(e) => handleChange('champion_id', parseInt(e.target.value))}
            style={styles.select}
            disabled={isLoadingUsers}
          >
            <option value="">All</option>
            {Array.isArray(qualityUsers) && qualityUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Customer Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Customer No</label>
          <input
            type="text"
            value={filters.customer_no || ''}
            onChange={(e) => handleChange('customer_no', e.target.value)}
            placeholder="Search..."
            style={styles.input}
          />
        </div>

        {/* Overdue Checkbox */}
        <div style={styles.checkboxGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={filters.overdue || false}
              onChange={(e) => handleChange('overdue', e.target.checked)}
              style={styles.checkbox}
            />
            <span>Show Overdue Only</span>
          </label>
        </div>

        {/* Clear Filters Button */}
        <div style={styles.buttonGroup}>
          <button onClick={handleClear} style={styles.clearButton}>
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: 'var(--color-surface)',
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1rem',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: '0.25rem',
  },
  select: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  checkbox: {
    width: '1rem',
    height: '1rem',
    cursor: 'pointer',
  },
  buttonGroup: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  clearButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};