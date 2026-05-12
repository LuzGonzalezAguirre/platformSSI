/**
 * Problem List - Main table view with filters
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblemList } from '../hooks/useProblemQueries';
import { ProblemFilters, ProblemStatus, ProblemSeverity } from '../types/problem.types';
import { useTranslation } from 'react-i18next';

export function ProblemList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProblemFilters>({});
  
  const { data: problems, isLoading, error } = useProblemList(filters);
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="error-container">
        <p>{t('common.error')}: {error.message}</p>
      </div>
    );
  }
  
  return (
    <div className="problem-list-page">
      <div className="page-header">
        <h1>{t('problemControl.title')}</h1>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/quality/problems/create')}
        >
          {t('problemControl.createNew')}
        </button>
      </div>
      
      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder={t('common.search')}
            className="search-input"
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        
        <div className="filter-group">
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as ProblemStatus })}
            className="filter-select"
          >
            <option value="">{t('problemControl.allStatus')}</option>
            <option value={ProblemStatus.DRAFT}>{t('problemControl.status.draft')}</option>
            <option value={ProblemStatus.PENDING_APPROVAL}>{t('problemControl.status.pending')}</option>
            <option value={ProblemStatus.APPROVED}>{t('problemControl.status.approved')}</option>
            <option value={ProblemStatus.CLOSED}>{t('problemControl.status.closed')}</option>
            <option value={ProblemStatus.REJECTED}>{t('problemControl.status.rejected')}</option>
          </select>
        </div>
        
        <div className="filter-group">
          <select
            value={filters.severity || ''}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value as ProblemSeverity })}
            className="filter-select"
          >
            <option value="">{t('problemControl.allSeverity')}</option>
            <option value={ProblemSeverity.CRITICAL}>{t('problemControl.severity.critical')}</option>
            <option value={ProblemSeverity.HIGH}>{t('problemControl.severity.high')}</option>
            <option value={ProblemSeverity.MEDIUM}>{t('problemControl.severity.medium')}</option>
            <option value={ProblemSeverity.LOW}>{t('problemControl.severity.low')}</option>
          </select>
        </div>
        
        {(filters.search || filters.status || filters.severity) && (
          <button
            className="btn btn-secondary"
            onClick={() => setFilters({})}
          >
            {t('common.clearFilters')}
          </button>
        )}
      </div>
      
      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('problemControl.number')}</th>
              <th>{t('problemControl.customer')}</th>
              <th>{t('problemControl.description')}</th>
              <th>{t('problemControl.status.label')}</th>
              <th>{t('problemControl.severity.label')}</th>
              <th>{t('problemControl.daysOpen')}</th>
              <th>{t('problemControl.overdue')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {problems && problems.length > 0 ? (
              problems.map((problem) => (
                <tr
                  key={problem.id}
                  className="table-row clickable"
                  onClick={() => navigate(`/quality/problems/${problem.id}`)}
                >
                  <td>
                    <strong>{problem.problem_number || t('problemControl.draft')}</strong>
                  </td>
                  <td>{problem.customer_name}</td>
                  <td className="description-cell">
                    {problem.description.length > 80
                      ? `${problem.description.substring(0, 80)}...`
                      : problem.description}
                  </td>
                  <td>
                    <StatusBadge status={problem.status} />
                  </td>
                  <td>
                    <SeverityBadge severity={problem.severity} />
                  </td>
                  <td>{problem.days_open}</td>
                  <td>
                    {problem.overdue_stages_count > 0 && (
                      <span className="badge badge-danger">
                        {problem.overdue_stages_count} {t('problemControl.overdueStages')}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/quality/problems/${problem.id}`);
                      }}
                    >
                      {t('common.view')}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center">
                  {t('problemControl.noProblems')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper components
function StatusBadge({ status }: { status: ProblemStatus }) {
  const { t } = useTranslation();
  
  const statusConfig = {
    [ProblemStatus.DRAFT]: { className: 'badge-secondary', label: t('problemControl.status.draft') },
    [ProblemStatus.PENDING_APPROVAL]: { className: 'badge-warning', label: t('problemControl.status.pending') },
    [ProblemStatus.APPROVED]: { className: 'badge-info', label: t('problemControl.status.approved') },
    [ProblemStatus.CLOSED]: { className: 'badge-success', label: t('problemControl.status.closed') },
    [ProblemStatus.REJECTED]: { className: 'badge-danger', label: t('problemControl.status.rejected') },
  };
  
  const config = statusConfig[status];
  
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}

function SeverityBadge({ severity }: { severity: ProblemSeverity }) {
  const { t } = useTranslation();
  
  const severityConfig = {
    [ProblemSeverity.CRITICAL]: { className: 'badge-danger', label: t('problemControl.severity.critical') },
    [ProblemSeverity.HIGH]: { className: 'badge-warning', label: t('problemControl.severity.high') },
    [ProblemSeverity.MEDIUM]: { className: 'badge-info', label: t('problemControl.severity.medium') },
    [ProblemSeverity.LOW]: { className: 'badge-secondary', label: t('problemControl.severity.low') },
  };
  
  const config = severityConfig[severity];
  
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}