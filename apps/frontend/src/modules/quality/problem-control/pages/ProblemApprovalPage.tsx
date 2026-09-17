import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../../../services/api.client';
import type { UserBasic } from '../types/problem.types';

type ApprovalRole = 'quality' | 'manufacturing' | 'production' | 'maintenance';

interface ApprovalItem {
  role: ApprovalRole;
  label: string;
  approver: UserBasic | null;
  approved_at: string | null;
  comments: string;
  can_approve: boolean;
}

interface ApprovalStatus {
  problem_id: number;
  problem_number: string | null;
  brief_description: string;
  status: string;
  status_display: string;
  approved_count: number;
  required_count: number;
  ready_to_close: boolean;
  approvals: ApprovalItem[];
}

const fmt = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const ProblemApprovalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [comments, setComments] = useState<Record<ApprovalRole, string>>({
    quality: '',
    manufacturing: '',
    production: '',
    maintenance: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<ApprovalStatus>({
    queryKey: ['problem-final-approvals', problemId],
    queryFn: async () => {
      const response = await apiClient.get(`/quality/problems/${problemId}/final-approvals/`);
      return response.data;
    },
    enabled: Number.isFinite(problemId),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ role, comment }: { role: ApprovalRole; comment: string }) => {
      const response = await apiClient.post(`/quality/problems/${problemId}/final-approvals/`, {
        role,
        comments: comment,
      });
      return response.data as ApprovalStatus;
    },
    onSuccess: (updated, variables) => {
      qc.setQueryData(['problem-final-approvals', problemId], updated);
      qc.invalidateQueries({ queryKey: ['problem', problemId] });
      qc.invalidateQueries({ queryKey: ['problems'] });
      setComments((prev) => ({ ...prev, [variables.role]: '' }));
      setMessage({ type: 'success', text: `${updated.approved_count} of 4 approvals completed.` });
    },
    onError: (err: any) => {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || err.message || 'Unable to record approval.',
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/quality/problems/${problemId}/close/`);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['problem', problemId] });
      qc.invalidateQueries({ queryKey: ['problems'] });
      setMessage({ type: 'success', text: 'Problem closed successfully.' });
      window.setTimeout(() => navigate('/quality/problems'), 700);
    },
    onError: (err: any) => {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || err.message || 'Unable to close problem.',
      });
    },
  });

  const percent = useMemo(() => {
    if (!data) return 0;
    return Math.round((data.approved_count / data.required_count) * 100);
  }, [data]);

  if (isLoading) {
    return <div style={s.state}>Loading approval workflow...</div>;
  }

  if (isError || !data) {
    return (
      <div style={s.state}>
        <strong>Unable to load approvals.</strong>
        <span>{(error as any)?.response?.data?.detail || (error as any)?.message || 'Unknown error'}</span>
        <button style={s.secondaryBtn} onClick={() => navigate('/quality/problems')}>Back to Problem Control</button>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <button style={s.backBtn} onClick={() => navigate('/quality/problems')}>← Back to Problem Control</button>

      <div style={s.header}>
        <div>
          <div style={s.eyebrow}>FINAL 8D APPROVAL</div>
          <h1 style={s.title}>{data.problem_number || `Problem #${data.problem_id}`}</h1>
          <p style={s.subtitle}>{data.brief_description}</p>
        </div>
        <div style={data.ready_to_close ? s.readyBadge : s.pendingBadge}>
          {data.ready_to_close ? '4/4 Approved' : `${data.approved_count}/4 Approved`}
        </div>
      </div>

      {message && (
        <div style={message.type === 'success' ? s.successMessage : s.errorMessage}>
          {message.text}
        </div>
      )}

      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <div>
            <strong>Approval progress</strong>
            <div style={s.helpText}>All four approvals are required before the problem can be formally closed.</div>
          </div>
          <span style={s.percent}>{percent}%</span>
        </div>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${percent}%` }} />
        </div>
      </div>

      <div style={s.grid}>
        {data.approvals.map((item, index) => {
          const approved = Boolean(item.approved_at);
          const typedComment = comments[item.role];
          const approverName = item.approver
            ? `${item.approver.first_name} ${item.approver.last_name}`.trim() || item.approver.username
            : 'Not assigned';

          return (
            <div key={item.role} style={{ ...s.card, ...(approved ? s.cardApproved : {}) }}>
              <div style={s.cardTop}>
                <div style={s.stepCircle}>{index + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={s.roleTitle}>{item.label}</div>
                  <div style={s.approverName}>{approverName}</div>
                  {item.approver?.job_title && <div style={s.jobTitle}>{item.approver.job_title}</div>}
                </div>
                <span style={approved ? s.approvedPill : s.pendingPill}>{approved ? 'Approved' : 'Pending'}</span>
              </div>

              {approved ? (
                <div style={s.approvedBody}>
                  <div style={s.approvedDate}>Approved {fmt(item.approved_at)}</div>
                  <div style={s.commentLabel}>Comments</div>
                  <div style={s.savedComment}>{item.comments || 'No comments recorded.'}</div>
                </div>
              ) : (
                <div style={s.pendingBody}>
                  {item.can_approve ? (
                    <>
                      <label style={s.commentLabel}>Approval comments *</label>
                      <textarea
                        rows={4}
                        value={typedComment}
                        onChange={(event) => setComments((prev) => ({ ...prev, [item.role]: event.target.value }))}
                        placeholder={`Add ${item.label} approval comments...`}
                        style={s.textarea}
                      />
                      <button
                        type="button"
                        style={{ ...s.approveBtn, ...(!typedComment.trim() || approveMutation.isPending ? s.disabled : {}) }}
                        disabled={!typedComment.trim() || approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ role: item.role, comment: typedComment.trim() })}
                      >
                        {approveMutation.isPending ? 'Saving approval...' : `Approve as ${item.label}`}
                      </button>
                    </>
                  ) : (
                    <div style={s.waitingBox}>
                      {!item.approver
                        ? 'An approver must be assigned before this approval can be completed.'
                        : 'Waiting for the authorized approver.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={data.ready_to_close ? s.closeReady : s.closePending}>
        <div>
          <div style={s.closeTitle}>{data.ready_to_close ? 'Approval cycle complete' : 'Waiting for final approvals'}</div>
          <div style={s.closeText}>
            {data.ready_to_close
              ? 'Quality, Manufacturing, Production and Maintenance have approved the 8D. The problem can now be closed.'
              : `${data.required_count - data.approved_count} approval${data.required_count - data.approved_count === 1 ? '' : 's'} remaining before formal closure.`}
          </div>
        </div>
        <button
          type="button"
          style={{ ...s.closeBtn, ...(!data.ready_to_close || closeMutation.isPending ? s.disabled : {}) }}
          disabled={!data.ready_to_close || closeMutation.isPending}
          onClick={() => {
            if (window.confirm('Close this problem? The four final approvals are complete.')) {
              closeMutation.mutate();
            }
          }}
        >
          {closeMutation.isPending ? 'Closing...' : 'Close Problem'}
        </button>
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
  state: { margin: '3rem auto', maxWidth: '520px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'center', color: 'var(--color-text-secondary)' },
  backBtn: { border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, padding: '0 0 1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' },
  eyebrow: { fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--color-primary)', marginBottom: '0.35rem' },
  title: { margin: 0, color: 'var(--color-text-primary)', fontSize: '1.8rem' },
  subtitle: { margin: '0.35rem 0 0', color: 'var(--color-text-secondary)' },
  readyBadge: { padding: '0.5rem 0.8rem', borderRadius: '999px', background: '#dcfce7', color: '#166534', fontSize: '0.8rem', fontWeight: 800 },
  pendingBadge: { padding: '0.5rem 0.8rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontSize: '0.8rem', fontWeight: 800 },
  successMessage: { padding: '0.8rem 1rem', border: '1px solid #bbf7d0', borderRadius: '0.5rem', background: '#f0fdf4', color: '#166534', marginBottom: '1rem', fontWeight: 600 },
  errorMessage: { padding: '0.8rem 1rem', border: '1px solid #fecaca', borderRadius: '0.5rem', background: '#fef2f2', color: '#991b1b', marginBottom: '1rem', fontWeight: 600 },
  progressCard: { padding: '1rem 1.1rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '0.75rem', marginBottom: '1rem' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' },
  helpText: { marginTop: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.8rem' },
  percent: { fontWeight: 800, color: 'var(--color-primary)' },
  progressTrack: { height: '8px', borderRadius: '999px', overflow: 'hidden', background: '#e5e7eb' },
  progressFill: { height: '100%', borderRadius: '999px', background: 'var(--color-primary)', transition: 'width .25s ease' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '1rem' },
  card: { border: '1px solid var(--color-border)', borderRadius: '0.75rem', background: 'var(--color-surface)', overflow: 'hidden' },
  cardApproved: { borderColor: '#86efac' },
  cardTop: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', borderBottom: '1px solid var(--color-border)' },
  stepCircle: { width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: 'var(--color-primary)', fontWeight: 800, flexShrink: 0 },
  roleTitle: { fontWeight: 800, color: 'var(--color-text-primary)' },
  approverName: { marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-primary)' },
  jobTitle: { fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.1rem' },
  approvedPill: { padding: '0.2rem 0.5rem', borderRadius: '999px', background: '#dcfce7', color: '#166534', fontSize: '0.7rem', fontWeight: 800 },
  pendingPill: { padding: '0.2rem 0.5rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 800 },
  approvedBody: { padding: '1rem', background: '#f0fdf4' },
  approvedDate: { color: '#166534', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.75rem' },
  pendingBody: { padding: '1rem' },
  commentLabel: { display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' },
  savedComment: { whiteSpace: 'pre-wrap', color: 'var(--color-text-primary)', fontSize: '0.85rem', lineHeight: 1.45 },
  textarea: { width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid var(--color-border)', borderRadius: '0.5rem', background: 'var(--color-bg)', color: 'var(--color-text-primary)', padding: '0.65rem', fontFamily: 'inherit', fontSize: '0.85rem' },
  approveBtn: { width: '100%', marginTop: '0.75rem', padding: '0.6rem 0.8rem', border: 'none', borderRadius: '0.5rem', background: '#16a34a', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  waitingBox: { padding: '0.8rem', borderRadius: '0.5rem', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontSize: '0.82rem' },
  closeReady: { marginTop: '1.25rem', padding: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', border: '1px solid #86efac', borderRadius: '0.75rem', background: '#f0fdf4' },
  closePending: { marginTop: '1.25rem', padding: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', border: '1px solid #fde68a', borderRadius: '0.75rem', background: '#fffbeb' },
  closeTitle: { fontWeight: 800, color: 'var(--color-text-primary)' },
  closeText: { marginTop: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.82rem' },
  closeBtn: { padding: '0.65rem 1rem', border: 'none', borderRadius: '0.5rem', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  secondaryBtn: { alignSelf: 'center', padding: '0.55rem 0.9rem', border: '1px solid var(--color-border)', borderRadius: '0.45rem', background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer' },
  disabled: { opacity: 0.45, cursor: 'not-allowed' },
};
