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

  const stats = [
    {
      label: 'Total Problems',
      value: problems.length,
      accentColor: '#0a6ebd',
      iconBg: '#eff6ff',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: 'Draft',
      value: problems.filter((p) => p.status === 'draft').length,
      accentColor: '#64748b',
      iconBg: '#f1f5f9',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      label: 'Pending Approval',
      value: problems.filter((p) => p.status === 'pending_approval').length,
      accentColor: '#d97706',
      iconBg: '#fffbeb',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Overdue',
      value: problems.filter((p) => p.is_overdue).length,
      accentColor: '#dc2626',
      iconBg: '#fef2f2',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.titleIconWrapper}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>Problem Control</h1>
            <p style={styles.subtitle}>8D Problem Solving & Customer Complaint Management</p>
          </div>
        </div>
        <button
          onClick={handleCreateNew}
          style={styles.createButton}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-primary-dark)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-primary)'; }}
        >
          <svg style={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Problem</span>
        </button>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div style={styles.statsGrid}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ ...styles.statCard, borderLeftColor: stat.accentColor }}>
              <div style={{ ...styles.statIconWrapper, backgroundColor: stat.iconBg, color: stat.accentColor }}>
                {stat.icon}
              </div>
              <div style={styles.statInfo}>
                <div style={styles.statLabel}>{stat.label}</div>
                <div style={{ ...styles.statValue, color: stat.accentColor }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <ProblemFilters onFilterChange={setFilters} />

      {/* Error State */}
      {error && (
        <div style={styles.errorBox}>
          <svg style={styles.errorIcon} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span style={styles.errorText}>
            Error loading problems: {(error as any)?.message || 'Unknown error'}
          </span>
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
    maxWidth: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  titleIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.75rem',
    height: '2.75rem',
    backgroundColor: '#eff6ff',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.625rem',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.8125rem',
    margin: '0.2rem 0 0',
  },
  createButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.125rem',
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxShadow: '0 1px 3px rgba(10, 110, 189, 0.3)',
  },
  buttonIcon: {
    width: '1.125rem',
    height: '1.125rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    backgroundColor: 'var(--color-surface)',
    padding: '1rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
    borderLeft: '4px solid transparent',
  },
  statIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.125rem',
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.875rem 1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1rem',
  },
  errorIcon: {
    width: '1.125rem',
    height: '1.125rem',
    color: '#ef4444',
    flexShrink: 0,
  },
  errorText: {
    color: '#991b1b',
    fontSize: '0.875rem',
  },
};
