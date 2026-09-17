import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../../../services/api.client';
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

interface ApprovalAssignmentsResponse {
  problem_ids: number[];
}

export const ProblemTable: React.FC<ProblemTableProps> = ({ problems, isLoading }) => {
  const navigate = useNavigate();
  const deleteMutation = useProblemDelete();

  const { data: approvalAssignments } = useQuery<ApprovalAssignmentsResponse>({
    queryKey: ['my-problem-approval-assignments'],
    queryFn: async () => {
      const response = await apiClient.get('/quality/problems/my-approval-assignments/');
      return response.data;
    },
    staleTime: 30000,
  });

  const approvalIds = new Set(approvalAssignments?.problem_ids ?? []);

  const handleView = (id: number) => navigate(`/quality/problems/${id}`);
  const handleEdit = (id: number) => navigate(`/quality/problems/${id}/edit`);
  const handleApproval = (id: number) => navigate(`/quality/problems/${id}/approval`);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this problem?')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error: any) {
      window.alert(error.response?.data?.detail || 'Error deleting problem');
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

  if (!problems?.length) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.centerState}>
          <p style={styles.emptyTitle}>No problems found</p>
          <p style={styles.emptySubtitle}>Create your first problem report to get started.</p>
        </div>
      </div>
    );
  }

  const columns = [
    'Problem #', 'Status', 'Description', 'Part No', 'Customer',
    'Champion', 'Severity', 'Created', 'Target Close', 'Actions',
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.scrollContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((label) => (
                <th key={label} style={{ ...styles.th, textAlign: label === 'Actions' ? 'right' : label === 'Severity' ? 'center' : 'left' }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {problems.map((problem, index) => {
              const canOpenApproval = approvalIds.has(problem.id);
              return (
                <tr
                  key={problem.id}
                  onClick={() => handleView(problem.id)}
                  style={{ ...styles.row, backgroundColor: index % 2 ? 'rgba(148, 163, 184, 0.04)' : 'transparent' }}
                >
                  <td style={styles.td}>
                    <div style={styles.inlineRow}>
                      <ProblemNumberDisplay problemNumber={problem.problem_number} id={problem.id} />
                      {problem.is_overdue && <OverdueIndicator isOverdue tooltip="One or more steps are overdue" />}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <StatusBadge status={problem.status} display={problem.status_display} />
                    <div style={styles.latestD}>{problem.latest_d}</div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.descText}>{problem.brief_description}</div>
                    <div style={styles.subText}>{problem.category_display}</div>
                  </td>
                  <td style={{ ...styles.td, ...styles.monoText }}>{problem.part_no || '—'}</td>
                  <td style={styles.td}>
                    <div style={styles.cellMain}>{problem.customer_no || '—'}</div>
                    <div style={styles.subText}>{problem.customer_name}</div>
                  </td>
                  <td style={styles.td}>{problem.champion.first_name} {problem.champion.last_name}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <SeverityBadge level={problem.severity_level_value} />
                  </td>
                  <td style={{ ...styles.td, ...styles.dateText }}>{formatDate(problem.created_at)}</td>
                  <td style={{ ...styles.td, ...styles.dateText }}>
                    {problem.target_close_date ? formatDate(problem.target_close_date) : '—'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={styles.actionsRow} onClick={(e) => e.stopPropagation()}>
                      <ActionButton
                        title="View full 8D"
                        color="#0a6ebd"
                        bgColor="#eff6ff"
                        hoverBg="#dbeafe"
                        onClick={() => handleView(problem.id)}
                        icon={
                          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        }
                      />

                      {canOpenApproval && (
                        <ActionButton
                          title="Final approvals"
                          color="#7c3aed"
                          bgColor="#f5f3ff"
                          hoverBg="#ede9fe"
                          onClick={() => handleApproval(problem.id)}
                          icon={
                            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          }
                        />
                      )}

                      {problem.status === 'draft' && (
                        <>
                          <ActionButton
                            title="Edit"
                            color="#16a34a"
                            bgColor="#f0fdf4"
                            hoverBg="#dcfce7"
                            onClick={() => handleEdit(problem.id)}
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
                            onClick={(e) => handleDelete(problem.id, e)}
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
            })}
          </tbody>
        </table>
      </div>
      <div style={styles.tableFooter}>{problems.length} record{problems.length !== 1 ? 's' : ''}</div>
    </div>
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
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...styles.actionButton, color, backgroundColor: hovered ? hoverBg : bgColor }}
    >
      {icon}
    </button>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: { backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-border)', overflow: 'hidden' },
  scrollContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  th: { padding: '0.75rem 1.25rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', backgroundColor: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' },
  row: { cursor: 'pointer', borderBottom: '1px solid var(--color-border)' },
  td: { padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', verticalAlign: 'middle' },
  inlineRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  descText: { fontWeight: 500, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subText: { fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' },
  cellMain: { fontWeight: 500 },
  monoText: { fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  dateText: { color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8125rem' },
  actionsRow: { display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' },
  actionButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.875rem', height: '1.875rem', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background-color 0.15s ease' },
  tableFooter: { padding: '0.625rem 1.25rem', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' },
  centerState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '0.75rem' },
  emptyTitle: { fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 },
  emptySubtitle: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 },
  spinner: { width: '2rem', height: '2rem', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%' },
  latestD: { marginTop: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' },
};
