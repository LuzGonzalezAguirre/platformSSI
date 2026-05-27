import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblemDetail } from '../hooks/useProblemDetail';
import { useProblemSubmit, useProblemApprove, useProblemReject, useProblemClose, useProblemDelete } from '../hooks/useProblemMutations';
import { StatusBadge } from '../components/shared/StatusBadge';
import { SeverityBadge } from '../components/shared/SeverityBadge';
import { StepMediaBar } from '../components/shared/StepMediaBar';
import type { Problem, ContainmentAction, CorrectiveAction, VerificationAction, PreventionAction, FiveWhyAnalysis } from '../types/problem.types';

// ─── Small helpers ────────────────────────────────────────────────────────────

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const fmtDt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={s.card}>
    <h3 style={s.cardTitle}>{title}</h3>
    <div style={s.cardBody}>{children}</div>
  </div>
);

const Field: React.FC<{ label: string; value?: string | number | null; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={s.field}>
    <div style={s.fieldLabel}>{label}</div>
    <div style={{ ...s.fieldValue, ...(mono ? { fontFamily: 'monospace', fontSize: '0.8rem' } : {}) }}>
      {value || '—'}
    </div>
  </div>
);

const Grid: React.FC<{ cols?: number; children: React.ReactNode }> = ({ cols = 3, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '1rem' }}>
    {children}
  </div>
);

const FullField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div style={{ ...s.field, gridColumn: '1 / -1' }}>
    <div style={s.fieldLabel}>{label}</div>
    <div style={{ ...s.fieldValue, whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
  </div>
);

// ─── Action tables ────────────────────────────────────────────────────────────

const ContainmentTable: React.FC<{ actions: ContainmentAction[] }> = ({ actions }) => {
  if (!actions.length) return <p style={s.emptyText}>No containment actions recorded.</p>;
  return (
    <table style={s.table}>
      <thead>
        <tr>
          {['Action', 'Response', 'Responsible', 'Due Date', 'Completion', 'Status'].map(h => (
            <th key={h} style={s.th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {actions.map(a => (
          <tr key={a.id} style={s.tr}>
            <td style={s.td}>{a.action}</td>
            <td style={s.td}>{a.response || '—'}</td>
            <td style={s.td}>{a.responsible ? `${a.responsible.first_name} ${a.responsible.last_name}` : '—'}</td>
            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmt(a.due_date)}</td>
            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmt(a.completion_date)}</td>
            <td style={s.td}>
              {a.completion_date
                ? <span style={s.badgeGreen}>Done</span>
                : a.ongoing
                  ? <span style={s.badgeBlue}>Ongoing</span>
                  : <span style={s.badgeGray}>Pending</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ActionTable: React.FC<{
  actions: (CorrectiveAction | VerificationAction | PreventionAction)[];
  showRootCause?: boolean;
}> = ({ actions, showRootCause }) => {
  if (!actions.length) return <p style={s.emptyText}>No actions recorded.</p>;
  return (
    <table style={s.table}>
      <thead>
        <tr>
          {showRootCause && <th style={s.th}>Root Cause</th>}
          {['Action', 'Response', 'Responsible', 'Due Date', 'Completion', 'Status'].map(h => (
            <th key={h} style={s.th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {actions.map(a => (
          <tr key={a.id} style={s.tr}>
            {showRootCause && (
              <td style={{ ...s.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(a as CorrectiveAction).root_cause_description || '—'}
              </td>
            )}
            <td style={s.td}>{a.action}</td>
            <td style={s.td}>{a.response || '—'}</td>
            <td style={s.td}>{a.responsible ? `${a.responsible.first_name} ${a.responsible.last_name}` : '—'}</td>
            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmt(a.due_date)}</td>
            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmt(a.completion_date)}</td>
            <td style={s.td}>
              {a.completion_date
                ? <span style={s.badgeGreen}>Done</span>
                : a.ongoing
                  ? <span style={s.badgeBlue}>Ongoing</span>
                  : <span style={s.badgeGray}>Pending</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const FiveWhySection: React.FC<{ analysis: FiveWhyAnalysis }> = ({ analysis }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <h4 style={s.subCardTitle}>{analysis.category_display}</h4>
    {analysis.root_causes.length === 0 ? (
      <p style={s.emptyText}>No rows added.</p>
    ) : (
      <table style={s.table}>
        <thead>
          <tr>
            {['Row', 'Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5', 'Root Cause'].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {analysis.root_causes.map(rc => (
            <tr key={rc.id} style={s.tr}>
              <td style={{ ...s.td, fontWeight: 600, width: 40 }}>{rc.order}</td>
              <td style={s.td}>{rc.why1 || '—'}</td>
              <td style={s.td}>{rc.why2 || '—'}</td>
              <td style={s.td}>{rc.why3 || '—'}</td>
              <td style={s.td}>{rc.why4 || '—'}</td>
              <td style={s.td}>{rc.why5 || '—'}</td>
              <td style={{ ...s.td, fontWeight: 500, color: '#6366f1' }}>{rc.root_cause || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export const ProblemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const problemId = Number(id);

  const { data: problem, isLoading, error } = useProblemDetail(problemId);
  const submitMutation = useProblemSubmit();
  const approveMutation = useProblemApprove();
  const rejectMutation = useProblemReject();
  const closeMutation = useProblemClose();
  const deleteMutation = useProblemDelete();

  const [rejectComments, setRejectComments] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveComments, setApproveComments] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);

  const isBusy =
    submitMutation.isPending || approveMutation.isPending ||
    rejectMutation.isPending || closeMutation.isPending || deleteMutation.isPending;

  const handleSubmit = async () => {
    if (!window.confirm('Submit this problem for approval? You will not be able to edit it after submission.')) return;
    try {
      await submitMutation.mutateAsync(problemId);
      alert('Problem submitted for approval.');
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id: problemId, data: { comments: approveComments } });
      setShowApproveModal(false);
      alert('Problem approved.');
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  const handleReject = async () => {
    if (!rejectComments.trim()) { alert('Rejection reason is required.'); return; }
    try {
      await rejectMutation.mutateAsync({ id: problemId, data: { comments: rejectComments } });
      setShowRejectModal(false);
      alert('Problem rejected.');
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Close this problem? Ensure all steps are complete.')) return;
    try {
      await closeMutation.mutateAsync(problemId);
      alert('Problem closed successfully.');
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this draft problem? This cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync(problemId);
      navigate('/quality/problems');
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={s.centeredState}>
        <div style={s.spinner} />
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem' }}>Loading problem…</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div style={s.centeredState}>
        <p style={{ color: '#dc2626' }}>Problem not found or access denied.</p>
        <button onClick={() => navigate('/quality/problems')} style={s.backBtn}>← Back to List</button>
      </div>
    );
  }

  const canEdit = problem.status === 'draft' || problem.status === 'approved';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>

      {/* ── Back ── */}
      <button onClick={() => navigate('/quality/problems')} style={s.backBtn}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to List
      </button>

      {/* ── Header card ── */}
      <div style={s.headerCard}>
        <div style={s.headerTop}>
          <div>
            <div style={s.problemNumber}>{problem.problem_number ?? `CA-00-00-${String(problem.id).padStart(5, '0')}`}</div>
            <div style={s.briefDesc}>{problem.brief_description}</div>
          </div>
          <div style={s.headerBadges}>
            <StatusBadge status={problem.status} display={problem.status_display} />
            <SeverityBadge level={problem.severity_level_data?.level ?? 0} />
          </div>
        </div>
        <div style={s.metaGrid}>
          <div style={s.metaItem}><span style={s.metaLabel}>Created</span><span>{fmtDt(problem.created_at)}</span></div>
          <div style={s.metaItem}><span style={s.metaLabel}>Champion</span><span>{problem.champion?.first_name} {problem.champion?.last_name}</span></div>
          <div style={s.metaItem}><span style={s.metaLabel}>Category</span><span>{problem.category_display || '—'}</span></div>
          <div style={s.metaItem}><span style={s.metaLabel}>Target Close</span><span>{fmt(problem.target_close_date)}</span></div>
          {problem.approved_at && (
            <div style={s.metaItem}><span style={s.metaLabel}>Approved</span><span>{fmtDt(problem.approved_at)}</span></div>
          )}
          {problem.closed_at && (
            <div style={s.metaItem}><span style={s.metaLabel}>Closed</span><span>{fmtDt(problem.closed_at)}</span></div>
          )}
        </div>
        {problem.approval_comments && (
          <div style={s.commentsBox}>
            <span style={s.metaLabel}>Approval Comments: </span>{problem.approval_comments}
          </div>
        )}
      </div>

      {/* ── D1 ── */}
      <SectionCard title="D1 — Problem Definition">
        <Grid cols={3}>
          <FullField label="Brief Description" value={problem.brief_description} />
          <FullField label="Full Description" value={problem.full_description} />
          <Field label="Problem Type" value={problem.problem_type_display} />
          <Field label="Category" value={problem.category_display} />
          <Field label="Severity Context" value={problem.severity_context} />
          <Field label="Date of Occurrence" value={fmtDt(problem.date_of_occurrence)} />
          <Field label="Part No" value={problem.part_no} mono />
          <Field label="Part Name" value={problem.part_name} />
          <Field label="Department" value={problem.department_name || problem.department_code} />
          <Field label="Workcenter" value={problem.workcenter_name || problem.workcenter_code} />
          <Field label="Shift" value={problem.shift_display} />
          <Field label="Defect Type" value={problem.defect_type_data?.description} />
          <Field label="Qty Placed on Hold" value={problem.quantity_placed_on_hold} />
          <Field label="Qty Rejected" value={problem.quantity_rejected} />
          <Field label="Building" value={problem.building} />
        </Grid>

        {(problem.customer_no || problem.supplier_no) && (
          <>
            <div style={s.divider} />
            <Grid cols={3}>
              {problem.customer_no && <>
                <Field label="Customer No" value={problem.customer_no} mono />
                <Field label="Customer Name" value={problem.customer_name} />
                <Field label="Customer Part No" value={problem.customer_part_no} mono />
                <Field label="Customer Contact" value={problem.customer_contact_name} />
                <Field label="Customer Email" value={problem.customer_contact_email} />
                <Field label="Customer Phone" value={problem.customer_contact_phone} />
              </>}
              {problem.supplier_no && <>
                <Field label="Supplier No" value={problem.supplier_no} mono />
                <Field label="Supplier Name" value={problem.supplier_name} />
                <Field label="Supplier Email" value={problem.supplier_email} />
              </>}
            </Grid>
          </>
        )}
        <StepMediaBar problemId={problemId} step="step1" readOnly />
      </SectionCard>

      {/* ── D2 — Team ── */}
      <SectionCard title="D2 — Team">
        <div style={s.teamGrid}>
          {[{ label: 'Champion', user: problem.champion }, ...problem.team_members.map(u => ({ label: 'Member', user: u }))].map(({ label, user }, i) => (
            <div key={i} style={s.memberCard}>
              <div style={s.memberAvatar}>{user.first_name[0]}{user.last_name[0]}</div>
              <div>
                <div style={s.memberName}>{user.first_name} {user.last_name}</div>
                <div style={s.memberRole}>{label}</div>
                <div style={s.memberEmail}>{user.email}</div>
              </div>
            </div>
          ))}
        </div>
        {problem.team_note && <div style={s.commentsBox}><span style={s.metaLabel}>Note: </span>{problem.team_note}</div>}
        <StepMediaBar problemId={problemId} step="step2" readOnly />
      </SectionCard>

      {/* ── D3 — Initial Response ── */}
      <SectionCard title="D3 — Initial Response">
        <Grid cols={3}>
          <FullField label="Initial Response" value={problem.initial_response} />
          <Field label="Tracking / Lot Batch No" value={problem.tracking_lot_batch_no} />
          <Field label="Build/Ship Date" value={fmt(problem.tracking_build_ship_date)} />
          <Field label="Completion Date" value={fmt(problem.initial_response_date)} />
          <Field label="Due" value={fmtDt(problem.initial_response_due)} />
        </Grid>
        <StepMediaBar problemId={problemId} step="step3a" readOnly />
      </SectionCard>

      {/* ── D3 — Containment ── */}
      <SectionCard title="D3 — Containment Actions">
        <ContainmentTable actions={problem.containment_actions} />
        <StepMediaBar problemId={problemId} step="step3b" readOnly />
      </SectionCard>

      {/* ── D4 — Five Why ── */}
      <SectionCard title="D4 — Five Why Analysis">
        {problem.five_why_analyses.length === 0
          ? <p style={s.emptyText}>No Five Why analyses recorded.</p>
          : problem.five_why_analyses.map(a => <FiveWhySection key={a.id} analysis={a} />)}
        <StepMediaBar problemId={problemId} step="step4" readOnly />
      </SectionCard>

      {/* ── D5 — Corrective Actions ── */}
      <SectionCard title="D5 — Corrective Actions">
        <ActionTable actions={problem.corrective_actions} showRootCause />
        <StepMediaBar problemId={problemId} step="step5" readOnly />
      </SectionCard>

      {/* ── D6 — Verification ── */}
      <SectionCard title="D6 — Verification">
        <ActionTable actions={problem.verification_actions} />
        <StepMediaBar problemId={problemId} step="step6" readOnly />
      </SectionCard>

      {/* ── D7 — Prevention ── */}
      <SectionCard title="D7 — Prevention / Control">
        <ActionTable actions={problem.prevention_actions} />
        <StepMediaBar problemId={problemId} step="step7" readOnly />
      </SectionCard>

      {/* ── FMEA & Control Plan ── */}
      <SectionCard title="FMEA & Control Plan">
        <Grid cols={3}>
          <Field label="FMEA Update Required" value={problem.fmea_update_required ? 'Yes' : 'No'} />
          <Field label="FMEA Responsible" value={problem.fmea_responsible ? `${problem.fmea_responsible.first_name} ${problem.fmea_responsible.last_name}` : undefined} />
          <Field label="FMEA Due" value={fmt(problem.fmea_due)} />
          <Field label="FMEA Completed" value={fmt(problem.fmea_completed)} />
          <Field label="FMEA Re-eval" value={fmt(problem.fmea_re_eval)} />
          <div />
          <Field label="Control Plan Update Required" value={problem.control_plan_update_required ? 'Yes' : 'No'} />
          <Field label="CP Responsible" value={problem.control_plan_responsible ? `${problem.control_plan_responsible.first_name} ${problem.control_plan_responsible.last_name}` : undefined} />
          <Field label="CP Due" value={fmt(problem.control_plan_due)} />
          <Field label="CP Completed" value={fmt(problem.control_plan_completed)} />
          <Field label="CP Re-eval" value={fmt(problem.control_plan_re_eval)} />
        </Grid>
      </SectionCard>

      {/* ── Workflow Buttons ── */}
      <div style={s.workflowBar}>
        {canEdit && (
          <button
            onClick={() => navigate(`/quality/problems/${id}/edit`)}
            style={s.btnEdit}
            disabled={isBusy}
          >
            Edit Problem
          </button>
        )}

        {problem.status === 'draft' && (
          <>
            <button onClick={handleSubmit} style={s.btnPrimary} disabled={isBusy}>
              Submit for Approval
            </button>
            <button onClick={handleDelete} style={s.btnDanger} disabled={isBusy}>
              Delete Draft
            </button>
          </>
        )}

        {problem.status === 'pending_approval' && (
          <>
            <button onClick={() => setShowApproveModal(true)} style={s.btnSuccess} disabled={isBusy}>
              Approve
            </button>
            <button onClick={() => setShowRejectModal(true)} style={s.btnDanger} disabled={isBusy}>
              Reject
            </button>
          </>
        )}

        {problem.status === 'approved' && (
          <button onClick={handleClose} style={s.btnPrimary} disabled={isBusy}>
            Close Problem
          </button>
        )}
      </div>

      {/* ── Approve Modal ── */}
      {showApproveModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Approve Problem</h3>
            <label style={s.fieldLabel}>Comments (optional)</label>
            <textarea
              value={approveComments}
              onChange={e => setApproveComments(e.target.value)}
              rows={3}
              style={s.modalTextarea}
              placeholder="Approval comments…"
            />
            <div style={s.modalActions}>
              <button onClick={() => setShowApproveModal(false)} style={s.btnCancel}>Cancel</button>
              <button onClick={handleApprove} style={s.btnSuccess} disabled={isBusy}>Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {showRejectModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Reject Problem</h3>
            <label style={s.fieldLabel}>Rejection Reason <span style={{ color: '#dc2626' }}>*</span></label>
            <textarea
              value={rejectComments}
              onChange={e => setRejectComments(e.target.value)}
              rows={3}
              style={s.modalTextarea}
              placeholder="Explain why this problem is being rejected…"
            />
            <div style={s.modalActions}>
              <button onClick={() => setShowRejectModal(false)} style={s.btnCancel}>Cancel</button>
              <button onClick={handleReject} style={s.btnDanger} disabled={isBusy || !rejectComments.trim()}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: '100%' },
  centeredState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', gap: '1rem' },
  spinner: { width: '2.5rem', height: '2.5rem', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  backBtn: { display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', marginBottom: '1.25rem', padding: '0.25rem 0' },

  // Header card
  headerCard: { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '1.5rem', marginBottom: '1.25rem' },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' },
  problemNumber: { fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.05em' },
  briefDesc: { fontSize: '1rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' },
  headerBadges: { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' },
  metaGrid: { display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.875rem' },
  metaItem: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  metaLabel: { fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' },
  commentsBox: { marginTop: '0.75rem', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--color-text-primary)' },

  // Cards
  card: { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', marginBottom: '1.25rem', overflow: 'hidden' },
  cardTitle: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 },
  cardBody: { padding: '1.25rem' },
  subCardTitle: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' },

  // Fields
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  fieldLabel: { fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' },
  fieldValue: { fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: 500 },
  divider: { borderTop: '1px solid var(--color-border)', margin: '1rem 0' },
  emptyText: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '0.5rem 0' },

  // Team
  teamGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.875rem' },
  memberCard: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg)' },
  memberAvatar: { width: '2.25rem', height: '2.25rem', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 },
  memberName: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' },
  memberRole: { fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500 },
  memberEmail: { fontSize: '0.75rem', color: 'var(--color-text-secondary)' },

  // Tables
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' },
  th: { padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-bg)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--color-border)' },
  td: { padding: '0.625rem 0.75rem', color: 'var(--color-text-primary)', verticalAlign: 'top' },

  // Status badges
  badgeGreen: { display: 'inline-block', padding: '0.125rem 0.5rem', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600 },
  badgeBlue: { display: 'inline-block', padding: '0.125rem 0.5rem', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600 },
  badgeGray: { display: 'inline-block', padding: '0.125rem 0.5rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600 },

  // Workflow bar
  workflowBar: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', padding: '1.25rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' },
  btnEdit: { padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  btnPrimary: { padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  btnSuccess: { padding: '0.625rem 1.25rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  btnDanger: { padding: '0.625rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  btnCancel: { padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' },

  // Modal
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '28rem', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalTitle: { fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1rem', marginTop: 0 },
  modalTextarea: { width: '100%', padding: '0.625rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', resize: 'vertical', boxSizing: 'border-box', marginTop: '0.375rem' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' },
};
