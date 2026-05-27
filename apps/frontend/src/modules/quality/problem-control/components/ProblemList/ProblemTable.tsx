// apps/frontend/src/features/quality/problem-control/components/ProblemList/ProblemTable.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProblemListItem } from '../../types/problem.types';
import { StatusBadge } from '../shared/StatusBadge';
import { SeverityBadge } from '../shared/SeverityBadge';
import { OverdueIndicator } from '../shared/OverdueIndicator';
import { ProblemNumberDisplay } from '../shared/ProblemNumberDisplay';
import { useProblemDelete } from '../../hooks/useProblemMutations';

interface ProblemTableProps {
  problems: ProblemListItem[];
  isLoading: boolean;
}

export const ProblemTable: React.FC<ProblemTableProps> = ({ problems, isLoading }) => {
  const navigate = useNavigate();
  const deleteMutation = useProblemDelete();

  const handleView = (id: number) => navigate(`/quality/problems/${id}`);
  const handleEdit = (id: number) => navigate(`/quality/problems/${id}/edit`);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this problem?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error: any) {
        alert(error.response?.data?.detail || 'Error deleting problem');
      }
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  if (isLoading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.centerState}>
          <div style={styles.spinner} />
          <p style={styles.emptySubtitle}>Loading problems...</p>
        </div>
      </div>
    );
  }

  if (!problems || problems.length === 0) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.centerState}>
          <svg style={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p style={styles.emptyTitle}>No problems found</p>
          <p style={styles.emptySubtitle}>Create your first problem report to get started.</p>
        </div>
      </div>
    );
  }

  const columns = [
    { label: 'Problem #', align: 'left' as const },
    { label: 'Status', align: 'left' as const },
    { label: 'Description', align: 'left' as const },
    { label: 'Part No', align: 'left' as const },
    { label: 'Customer', align: 'left' as const },
    { label: 'Champion', align: 'left' as const },
    { label: 'Severity', align: 'center' as const },
    { label: 'Created', align: 'left' as const },
    { label: 'Target Close', align: 'left' as const },
    { label: 'Actions', align: 'right' as const },
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.scrollContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.label} style={{ ...styles.th, textAlign: col.align }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {problems.map((problem, index) => (
              <ProblemRow
                key={problem.id}
                problem={problem}
                index={index}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                formatDate={formatDate}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div style={styles.tableFooter}>
        <span style={styles.footerText}>{problems.length} record{problems.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

interface ProblemRowProps {
  problem: ProblemListItem;
  index: number;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  formatDate: (d: string) => string;
}

const ProblemRow: React.FC<ProblemRowProps> = ({ problem, index, onView, onEdit, onDelete, formatDate }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <tr
      onClick={() => onView(problem.id)}
      style={{
        ...styles.row,
        backgroundColor: hovered
          ? 'var(--color-bg)'
          : index % 2 !== 0
          ? 'rgba(148, 163, 184, 0.04)'
          : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Problem Number */}
      <td style={styles.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ProblemNumberDisplay problemNumber={problem.problem_number} id={problem.id} />
          {problem.is_overdue && (
            <OverdueIndicator isOverdue={true} tooltip="One or more steps are overdue" />
          )}
        </div>
      </td>

      {/* Status */}
      <td style={styles.td}>
        <StatusBadge status={problem.status} display={problem.status_display} />
      </td>

      {/* Description */}
      <td style={styles.td}>
        <div style={styles.descText}>{problem.brief_description}</div>
        <div style={styles.subText}>{problem.category_display}</div>
      </td>

      {/* Part No */}
      <td style={{ ...styles.td, ...styles.monoText }}>{problem.part_no || '—'}</td>

      {/* Customer */}
      <td style={styles.td}>
        <div style={styles.cellMain}>{problem.customer_no || '—'}</div>
        <div style={styles.subText}>{problem.customer_name}</div>
      </td>

      {/* Champion */}
      <td style={styles.td}>
        <div style={styles.cellMain}>
          {problem.champion.first_name} {problem.champion.last_name}
        </div>
      </td>

      {/* Severity */}
      <td style={{ ...styles.td, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SeverityBadge level={problem.severity_level_value} />
        </div>
      </td>

      {/* Created */}
      <td style={{ ...styles.td, ...styles.dateText }}>{formatDate(problem.created_at)}</td>

      {/* Target Close */}
      <td style={{ ...styles.td, ...styles.dateText }}>
        {problem.target_close_date ? formatDate(problem.target_close_date) : '—'}
      </td>

      {/* Actions */}
      <td style={{ ...styles.td, textAlign: 'right' }}>
        <div style={styles.actionsRow} onClick={(e) => e.stopPropagation()}>
          <ActionButton
            title="View"
            color="#0a6ebd"
            bgColor="#eff6ff"
            hoverBg="#dbeafe"
            onClick={() => onView(problem.id)}
            icon={
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />
          {problem.status === 'draft' && (
            <>
              <ActionButton
                title="Edit"
                color="#16a34a"
                bgColor="#f0fdf4"
                hoverBg="#dcfce7"
                onClick={() => onEdit(problem.id)}
                icon={
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
              />
              <ActionButton
                title="Delete"
                color="#dc2626"
                bgColor="#fef2f2"
                hoverBg="#fee2e2"
                onClick={(e) => onDelete(problem.id, e)}
                icon={
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

interface ActionButtonProps {
  title: string;
  color: string;
  bgColor: string;
  hoverBg: string;
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, color, bgColor, hoverBg, onClick, icon }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.875rem',
        height: '1.875rem',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        color,
        backgroundColor: hovered ? hoverBg : bgColor,
        transition: 'background-color 0.15s ease',
      }}
    >
      {icon}
    </button>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
  },
  scrollContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '900px',
  },
  th: {
    padding: '0.75rem 1.25rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    backgroundColor: 'var(--color-bg)',
    borderBottom: '2px solid var(--color-border)',
    whiteSpace: 'nowrap',
  },
  row: {
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
    borderBottom: '1px solid var(--color-border)',
  },
  td: {
    padding: '0.875rem 1.25rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  },
  descText: {
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    maxWidth: '220px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subText: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    marginTop: '2px',
  },
  cellMain: {
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  },
  dateText: {
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    fontSize: '0.8125rem',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.375rem',
  },
  tableFooter: {
    padding: '0.625rem 1.25rem',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
  },
  footerText: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
  },
  centerState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    gap: '0.75rem',
  },
  emptyIcon: {
    width: '3rem',
    height: '3rem',
    color: 'var(--color-text-secondary)',
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  emptySubtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid var(--color-border)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
