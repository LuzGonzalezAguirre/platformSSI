// D8 — Approvals & Congratulate the Team
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWizardStore } from '../../store/wizardStore';
import { useProblemDetail } from '../../hooks/useProblemDetail';
import { StepMediaBar } from '../shared/StepMediaBar';

export const Step8_D8_Congratulate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;
  const setStepValidation = useWizardStore((s) => s.setStepValidation);
  const { data: problem } = useProblemDetail(problemId);

  useEffect(() => { setStepValidation(8, true); }, [setStepValidation]);

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

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
      <h2 style={s.title}>D8 — Approvals</h2>

      {/* ── Approvals table ── */}
      <div style={s.card}>
        <div style={s.tableWrap}>
          {approvals.length === 0 ? (
            <p style={s.empty}>No approvals recorded yet. Submit the problem for approval to continue.</p>
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
                    <td style={s.tdStatus}>
                      <span style={s.approvedBadge}>{a.status}</span>
                    </td>
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

      {/* ── Congratulate Team ── */}
      <div style={s.banner}>
        <div style={s.trophy}>🏆</div>
        <h3 style={s.congratTitle}>CONGRATULATE TEAM</h3>
        <p style={s.congratSubtitle}>
          Recognize the effort and dedication of everyone involved in resolving this problem.
        </p>
      </div>

      {teamMembers.length > 0 && (
        <div style={s.memberGrid}>
          {teamMembers.map((member) =>
            member ? (
              <div key={member.id} style={s.memberCard}>
                <div style={s.avatar}>
                  {member.first_name[0]}{member.last_name[0]}
                </div>
                <div>
                  <div style={s.memberName}>{member.first_name} {member.last_name}</div>
                  <div style={s.memberEmail}>{member.email}</div>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* ── 8D Summary ── */}
      <div style={s.card}>
        <div style={s.summaryGrid}>
          {[
            { d: 'D1', label: 'Problem Defined' },
            { d: 'D2', label: 'Team Assembled' },
            { d: 'D3', label: 'Initial Response & Containment' },
            { d: 'D4', label: 'Five Why Analysis' },
            { d: 'D5', label: 'Corrective Actions' },
            { d: 'D6', label: 'Verification' },
            { d: 'D7', label: 'Control / Prevention' },
            { d: 'D8', label: 'Team Recognized' },
          ].map(({ d, label }) => (
            <div key={d} style={s.summaryItem}>
              <span style={s.dBadge}>{d}</span>
              <span style={s.dLabel}>{label}</span>
              <span style={s.checkmark}>✓</span>
            </div>
          ))}
        </div>
      </div>

      {problemId && <StepMediaBar problemId={problemId} step="step8" />}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  title: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1rem' },
  card: { border: '1px solid var(--color-border)', borderRadius: '0.5rem', marginBottom: '1.25rem', overflow: 'hidden' },
  tableWrap: { overflowX: 'auto' },
  empty: { padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  th: { padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap' },
  trEven: { backgroundColor: 'var(--color-bg-primary)' },
  trOdd: { backgroundColor: '#f9fafb' },
  td: { padding: '0.75rem 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-primary)' },
  tdStatus: { padding: '0.75rem 0.875rem' },
  tdDate: { padding: '0.75rem 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  tdMuted: { padding: '0.75rem 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  approvedBadge: { display: 'inline-block', padding: '0.2rem 0.6rem', backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.75rem', fontWeight: 700, borderRadius: '9999px' },
  banner: { textAlign: 'center', padding: '2rem 1.5rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #86efac', borderRadius: '0.75rem', marginBottom: '1.25rem' },
  trophy: { fontSize: '3rem', marginBottom: '0.5rem' },
  congratTitle: { fontSize: '1.25rem', fontWeight: 800, color: '#15803d', margin: '0 0 0.375rem' },
  congratSubtitle: { fontSize: '0.9rem', color: '#166534', maxWidth: '500px', margin: '0 auto' },
  memberGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' },
  memberCard: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-secondary)' },
  avatar: { width: '2.25rem', height: '2.25rem', borderRadius: '50%', backgroundColor: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 },
  memberName: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' },
  memberEmail: { fontSize: '0.75rem', color: 'var(--color-text-secondary)' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', padding: '1rem' },
  summaryItem: { display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid #d1fae5', borderRadius: '0.375rem' },
  dBadge: { display: 'inline-block', padding: '0.125rem 0.4rem', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.7rem', fontWeight: 800, borderRadius: '0.25rem', flexShrink: 0 },
  dLabel: { fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 },
  checkmark: { color: '#16a34a', fontWeight: 700 },
};
