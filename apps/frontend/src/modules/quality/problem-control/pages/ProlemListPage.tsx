// apps/frontend/src/modules/quality/problem-control/pages/ProblemListPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProblemFilters } from '../components/ProblemList/ProblemFilters';
import { ProblemTable } from '../components/ProblemList/ProblemTable';
import { useProblemList } from '../hooks/useProblemList';
import type { ProblemFilters as Filters } from '../types/problem.types';

export const ProblemListPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({});
  
  const { data: problemsData, isLoading, error } = useProblemList(filters);
  const problems = Array.isArray(problemsData) ? problemsData : [];

  const handleCreateNew = () => {
    navigate('/quality/problems/new');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Problem Control</h1>
          <p style={styles.subtitle}>
            8D Problem Solving & Customer Complaint Management
          </p>
        </div>
        <button onClick={handleCreateNew} style={styles.createButton}>
          <svg style={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Problem</span>
        </button>
      </div>

      {/* Filters */}
      <ProblemFilters onFilterChange={setFilters} />

      {/* Error State */}
      {error && (
        <div style={styles.errorBox}>
          <svg style={styles.errorIcon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span style={styles.errorText}>
            Error loading problems: {(error as any)?.message || 'Unknown error'}
          </span>
        </div>
      )}

      {/* Stats Summary */}
      {problems.length > 0 && !isLoading && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Problems</div>
            <div style={styles.statValue}>{problems.length}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Draft</div>
            <div style={styles.statValue}>
              {problems.filter((p) => p.status === 'draft').length}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Pending Approval</div>
            <div style={{ ...styles.statValue, color: '#d97706' }}>
              {problems.filter((p) => p.status === 'pending_approval').length}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Overdue</div>
            <div style={{ ...styles.statValue, color: '#dc2626' }}>
              {problems.filter((p) => p.is_overdue).length}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <ProblemTable problems={problems} isLoading={isLoading} />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
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
  createButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonIcon: {
    width: '1.25rem',
    height: '1.25rem',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
  },
  errorIcon: {
    width: '1.25rem',
    height: '1.25rem',
    color: '#ef4444',
  },
  errorText: {
    color: '#991b1b',
    fontSize: '0.875rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  statCard: {
    backgroundColor: 'var(--color-bg-secondary)',
    padding: '1rem',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '0.25rem',
  },
  statValue: {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
};