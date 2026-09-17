// D8 — Approvals & Congratulate the Team
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useWizardStore } from '../../store/wizardStore';
import { useProblemDetail } from '../../hooks/useProblemDetail';
import { StepMediaBar } from '../shared/StepMediaBar';

interface DStatus {
  d: string;
  label: string;
  complete: boolean;
  message: string;
}

export const Step8_D8_Congratulate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;
  const setStepValidation = useWizardStore((s) => s.setStepValidation);
  const { data: problem } = useProblemDetail(problemId);

  useEffect(() => { setStepValidation(8, true); }, [setStepValidation]);

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  // Keep this summary aligned with the same rules used by ProblemWizardPage submit validation.
  const dStatuses = useMemo<DStatus[]>(() => {
    if (!problem) {
      return [
        { d: 'D1', label: 'Problem Defined', complete: false, message: 'Save the problem first.' },
        { d: 'D2', label: 'Team Assembled', complete: true, message: 'Team step is available.' },
        { d: 'D3', label: 'Containment Actions', complete: false, message: 'Add at least one containment action.' },
        { d: 'D4', label: 'Five Why Analysis', complete: false, message: 'Complete Why 1, Why 2 and Why 3 in Made, Escape and Systemic.' },
        { d: 'D5', label: 'Corrective Actions', complete: false, message: 'Add at least one corrective action.' },
        { d: 'D6', label: 'Verification', complete: false, message: 'Upload test evidence for every D5 corrective action.' },
        { d: 'D7', label: 'Control / Prevention', complete: false, message: 'Add at least one prevention action.' },
      ];
    }

    const d1 = !!(
      problem.brief_description?.trim() &&
      problem.full_description?.trim() &&
      problem.problem_type &&
      problem.severity_level_data?.id &&
      problem.champion?.id &&
      problem.date_of_occurrence
    );

    const d3 = (problem.containment_actions?.length ?? 0) > 0;

    const requiredCategories = ['made', 'escape', 'systemic'];
    const d4 = requiredCategories.every((category) =>
      problem.five_why_analyses?.some((analysis) =>
        analysis.category === category &&
        analysis.root_causes?.some((rootCause) =>
          rootCause.why1?.trim() && rootCause.why2?.trim() && rootCause.why3?.trim()
        )
      )
    );

    const d5 = (problem.corrective_actions?.length ?? 0) > 0;
    const d6 = d5 && (problem.corrective_actions ?? []).every((action) =>
      problem.attachments?.some((attachment) =>
        attachment.step === 'step6' && attachment.corrective_action_id === action.id
      )
    );
    const d7 = (problem.prevention_actions?.length ?? 0) > 0;

    return [
      {
        d: 'D1',
        label: 'Problem Defined',
        complete: d1,
        message: d1 ? 'Problem definition is complete.' : 'Complete description, type, severity, champion and occurrence date.',
      },
      {
        d: 'D2',
        label: 'Team Assembled',
        complete: true,
        message: 'Team definition is complete.',
      },
      {
        d: 'D3',
        label: 'Containment Actions',
        complete: d3,
        message: d3 ? 'Containment is documented.' : 'Add at least one containment action.',
      },
      {
        d: 'D4',
        label: 'Five Why Analysis',
        complete: d4,
        message: d4 ? 'Required Five Why analyses are complete.' : 'Complete Why 1, Why 2 and Why 3 in Made, Escape and Systemic.',
      },
      {
        d: 'D5',
        label: 'Corrective Actions',
        complete: d5,
        message: d5 ? 'Corrective actions are documented.' : 'Add at least one corrective action.',
      },
      {
        d: 'D6',
        label: 'Verification',
        complete: d6,
        message: d6 ? 'Every corrective action has verification evidence.' : 'Upload test evidence for every D5 corrective action.',
      },
      {
        d: 'D7',
        label: 'Control / Prevention',
        complete: d7,
        message: d7 ? 'Prevention actions are documented.' : 'Add at least one prevention action.',
      },
    ];
  }, [problem]);

  const pendingSteps = dStatuses.filter((item) => !item.complete);
  const readyToSubmit = pendingSteps.length === 0;

  // Build approvals list from available problem data
  const approvals: { status: string; date: string | null; name: string; position: string; comments: string }[] = [];

  if (problem?.approved_by && problem?.approved_at) {
    approvals.push({
      status: 'Approved',
      date: problem.approved_at,
      name: `${problem.approved_by.first_name} ${problem.approved_by.last_name}`,
      position: problem.approved_by.email,
      comments: problem.approval_comments || '',
    });
  }

  const teamMembers = problem
    ? [problem.champion, ...(problem.team_members ?? [])].filter(
        (m, i, arr) => m && arr.findIndex((x) => x?.id === m.id) === i
      )
    : [];

  return (
    <div style={s.container}>
      <h2 style={s.title}>D8 — Review & Team Recognition</h2>
      <p style={s.subtitle}>
        Final review of the 8D. The status below uses the same requirements as Submit for Approval.
      </p>

      {/* ── Readiness summary ── */}
      <div style={readyToSubmit ? s.readyBanner : s.pendingBanner}>
        <div style={readyToSubmit ? s.readyIcon : s.pendingIcon}>{readyToSubmit ? '✓' : '!'}</div>
        <div style={s.bannerTextWrap}>
          <h3 style={readyToSubmit ? s.readyTitle : s.pendingTitle}>
            {readyToSubmit ? '8D ready for submission' : `8D not ready — ${pendingSteps.length} step${pendingSteps.length === 1 ? '' : 's'} pending`}
          </h3>
          <p style={readyToSubmit ? s.readyText : s.pendingText}>
            {readyToSubmit
              ? 'D1 through D7 meet the required completion criteria. You can submit the 8D for approval.'
              : 'Complete the pending items below before submitting the 8D for approval.'}
          </p>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.summaryHeader}>
          <div>
            <div style={s.summaryTitle}>8D Completion Check</div>
            <div style={s.summarySubtitle}>{dStatuses.filter((item) => item.complete).length} of {dStatuses.length} required steps complete</div>
          </div>
          <div style={readyToSubmit ? s.completePill : s.pendingPill}>
            {readyToSubmit ? 'Ready' : `${pendingSteps.length} Pending`}
          </div>
        </div>

        <div style={s.summaryGrid}>
          {dStatuses.map((item) => (
            <div key={item.d} style={item.complete ? s.summaryItemComplete : s.summaryItemPending}>
              <span style={item.complete ? s.dBadgeComplete : s.dBadgePending}>{item.d}</span>
              <div style={s.dContent}>
                <div style={s.dTopRow}>
                  <span style={s.dLabel}>{item.label}</span>
                  <span style={item.complete ? s.statusComplete : s.statusPending}>
                    {item.complete ? 'Complete' : 'Pending'}
                  </span>
                </div>
                <span style={s.dMessage}>{item.message}</span>
              </div>
              <span style={item.complete ? s.checkmark : s.warningMark}>{item.complete ? '✓' : '!'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Approvals table ── */}
      <div style={s.card}>
        <div style={s.sectionHeader}>
          <div style={s.sectionTitle}>Approval Status</div>
          <div style={s.sectionHint}>Approvals are recorded after the 8D is submitted.</div>
        </div>
        <div style={s.tableWrap}>
          {approvals.length === 0 ? (
            <p style={s.empty}>
              {readyToSubmit
                ? 'No approvals recorded yet. Submit the 8D for approval when ready.'
                : 'Approval has not started because the 8D still has pending steps.'}
            </p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Status', 'Approved Date', 'Approved By', 'Position', 'Comments'].map(h =>
                    <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {approvals.map((a, i) => (
                  <tr key={i} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={s.tdStatus}><span style={s.approvedBadge}>{a.status}</span></td>
                    <td style={s.tdDate}>{fmt(a.date)}</td>
                    <td style={s.td}>{a.name}</td>
                    <td style={s.tdMuted}>{a.position}</td>
                    <td style={s.td}>{a.comments || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Congratulate Team only when the work is actually complete ── */}
      {readyToSubmit && (
        <>
          <div style={s.congratBanner}>
            <div style={s.trophy}>🏆</div>
            <h3 style={s.congratTitle}>TEAM RECOGNITION</h3>
            <p style={s.congratSubtitle}>
              The required 8D work is complete. Recognize the team effort before sending the report through final approval.
            </p>
          </div>

          {teamMembers.length > 0 && (
            <div style={s.memberGrid}>
              {teamMembers.map((member) =>
                member ? (
                  <div key={member.id} style={s.memberCard}>
                    <div style={s.avatar}>
                      {(member.first_name?.[0] || member.username?.[0] || '?').toUpperCase()}
                      {(member.last_name?.[0] || '').toUpperCase()}
                    </div>
                    <div>
                      <div style={s.memberName}>
                        {`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username}
                      </div>
                      <div style={s.memberEmail}>{member.job_title || member.email || 'Team member'}</div>
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </>
      )}

      {problemId && <StepMediaBar problemId={problemId} step="step8" />}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  title: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0 0 1.25rem' },
  card: { border: '1px solid var(--color-border)', borderRadius: '0.65rem', marginBottom: '1.25rem', overflow: 'hidden', backgroundColor: 'var(--color-bg-secondary)' },
  readyBanner: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', marginBottom: '1.25rem', border: '1px solid #86efac', backgroundColor: '#f0fdf4', borderRadius: '0.65rem' },
  pendingBanner: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', marginBottom: '1.25rem', border: '1px solid #fcd34d', backgroundColor: '#fffbeb', borderRadius: '0.65rem' },
  readyIcon: { width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.15rem', flexShrink: 0 },
  pendingIcon: { width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.15rem', flexShrink: 0 },
  bannerTextWrap: { minWidth: 0 },
  readyTitle: { margin: 0, color: '#166534', fontSize: '1rem', fontWeight: 800 },
  pendingTitle: { margin: 0, color: '#92400e', fontSize: '1rem', fontWeight: 800 },
  readyText: { margin: '0.2rem 0 0', color: '#166534', fontSize: '0.84rem' },
  pendingText: { margin: '0.2rem 0 0', color: '#92400e', fontSize: '0.84rem' },
  summaryHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 1rem', borderBottom: '1px solid var(--color-border)' },
  summaryTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' },
  summarySubtitle: { fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' },
  completePill: { padding: '0.25rem 0.65rem', borderRadius: '999px', backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' },
  pendingPill: { padding: '0.25rem 0.65rem', borderRadius: '999px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.65rem', padding: '1rem' },
  summaryItemComplete: { display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.75rem', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '0.5rem' },
  summaryItemPending: { display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.75rem', border: '1px solid #fde68a', backgroundColor: '#fffbeb', borderRadius: '0.5rem' },
  dBadgeComplete: { display: 'inline-block', padding: '0.18rem 0.45rem', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.7rem', fontWeight: 800, borderRadius: '0.3rem', flexShrink: 0 },
  dBadgePending: { display: 'inline-block', padding: '0.18rem 0.45rem', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.7rem', fontWeight: 800, borderRadius: '0.3rem', flexShrink: 0 },
  dContent: { flex: 1, minWidth: 0 },
  dTopRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' },
  dLabel: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' },
  dMessage: { display: 'block', marginTop: '0.2rem', fontSize: '0.72rem', lineHeight: 1.35, color: 'var(--color-text-secondary)' },
  statusComplete: { fontSize: '0.68rem', fontWeight: 800, color: '#15803d' },
  statusPending: { fontSize: '0.68rem', fontWeight: 800, color: '#b45309' },
  checkmark: { color: '#16a34a', fontWeight: 800, fontSize: '1rem' },
  warningMark: { color: '#d97706', fontWeight: 800, fontSize: '1rem' },
  sectionHeader: { padding: '0.85rem 1rem', borderBottom: '1px solid var(--color-border)' },
  sectionTitle: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' },
  sectionHint: { fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' },
  tableWrap: { overflowX: 'auto' },
  empty: { padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  th: { padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap' },
  trEven: { backgroundColor: 'var(--color-bg-primary)' },
  trOdd: { backgroundColor: '#f9fafb' },
  td: { padding: '0.75rem 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-primary)' },
  tdStatus: { padding: '0.75rem 0.875rem' },
  tdDate: { padding: '0.75rem 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  tdMuted: { padding: '0.75rem 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  approvedBadge: { display: 'inline-block', padding: '0.2rem 0.6rem', backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.75rem', fontWeight: 700, borderRadius: '9999px' },
  congratBanner: { textAlign: 'center', padding: '1.75rem 1.5rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #86efac', borderRadius: '0.75rem', marginBottom: '1.25rem' },
  trophy: { fontSize: '2.5rem', marginBottom: '0.4rem' },
  congratTitle: { fontSize: '1.1rem', fontWeight: 800, color: '#15803d', margin: '0 0 0.3rem' },
  congratSubtitle: { fontSize: '0.85rem', color: '#166534', maxWidth: '580px', margin: '0 auto' },
  memberGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' },
  memberCard: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-secondary)' },
  avatar: { width: '2.25rem', height: '2.25rem', borderRadius: '50%', backgroundColor: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 },
  memberName: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' },
  memberEmail: { fontSize: '0.75rem', color: 'var(--color-text-secondary)' },
};
