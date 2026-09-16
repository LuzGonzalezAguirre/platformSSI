// D6 — Verification evidence copied from D5
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { problemApi } from '../../api/problemApi';
import { useCorrectiveActions } from '../../hooks/useCorrectiveActions';
import { useWizardStore } from '../../store/wizardStore';
import type { ProblemAttachment } from '../../types/problem.types';

export const Step6_Verification: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const problemId = id ? Number(id) : undefined;
  const qc = useQueryClient();
  const setStepValidation = useWizardStore((state) => state.setStepValidation);
  const { data: actions = [], isLoading } = useCorrectiveActions(problemId);
  const { data: attachments = [] } = useQuery<ProblemAttachment[]>({
    queryKey: ['attachments', problemId, 'step6'],
    queryFn: () => problemApi.getAttachments(problemId!, 'step6'),
    enabled: !!problemId,
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const uploadMutation = useMutation({
    mutationFn: ({ actionId, file }: { actionId: number; file: File }) =>
      problemApi.uploadAttachment(problemId!, 'step6', file, actionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', problemId, 'step6'] }),
    onError: (error: any) => alert(error.response?.data?.detail || error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => problemApi.deleteAttachment(attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', problemId, 'step6'] }),
    onError: (error: any) => alert(error.response?.data?.detail || error.message),
  });

  useEffect(() => {
    const complete = actions.length > 0 && actions.every((action) =>
      attachments.some((attachment) => attachment.corrective_action_id === action.id)
    );
    setStepValidation(6, complete);
  }, [actions, attachments, setStepValidation]);

  const fmt = (date: string | null | undefined) =>
    date ? new Date(date).toLocaleDateString() : '—';

  const evidenceFor = (actionId: number) =>
    attachments.filter((attachment) => attachment.corrective_action_id === actionId);

  return (
    <div style={s.container}>
      <h2 style={s.title}>D6 — Verification</h2>
      <p style={s.subtitle}>
        D5 corrective actions are copied here automatically. Open each line to review it and upload its test evidence.
      </p>

      {!problemId && <div style={s.warning}>Save the problem before uploading verification evidence.</div>}

      <div style={s.tableWrap}>
        {isLoading ? (
          <p style={s.empty}>Loading D5 actions...</p>
        ) : actions.length === 0 ? (
          <p style={s.empty}>No D5 corrective actions are available yet.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Root Cause (Last Why)', 'Corrective Action', 'Response', 'Responsible', 'Due Date', 'Active', 'Evidence', ''].map((heading) => (
                  <th key={heading} style={s.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((action, index) => {
                const evidence = evidenceFor(action.id);
                const expanded = expandedId === action.id;
                return (
                  <React.Fragment key={action.id}>
                    <tr style={index % 2 === 0 ? s.trEven : s.trOdd}>
                      <td style={s.tdRoot}>{action.root_cause_description || '—'}</td>
                      <td style={s.td}>{action.action}</td>
                      <td style={s.tdMuted}>{action.response || '—'}</td>
                      <td style={s.tdNowrap}>
                        {action.responsible
                          ? `${action.responsible.first_name} ${action.responsible.last_name}`
                          : '—'}
                      </td>
                      <td style={s.tdDate}>{fmt(action.due_date)}</td>
                      <td style={s.tdCenter}>{action.active ? <span style={s.activeDot}>●</span> : '—'}</td>
                      <td style={s.tdCenter}>
                        <span style={evidence.length ? s.evidenceReady : s.evidenceMissing}>
                          {evidence.length} file{evidence.length === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td style={s.tdBtn}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : action.id)}
                          style={s.viewBtn}
                        >
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={8} style={s.evidenceCell}>
                          <div style={s.evidencePanel}>
                            <div>
                              <strong>Test evidence for this line</strong>
                              <div style={s.evidenceList}>
                                {evidence.length === 0 && <span style={s.noEvidence}>No evidence uploaded yet.</span>}
                                {evidence.map((attachment) => (
                                  <span key={attachment.id} style={s.fileChip}>
                                    <a href={attachment.file} target="_blank" rel="noopener noreferrer" style={s.fileLink}>
                                      {attachment.filename}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm('Delete this evidence file?')) {
                                          deleteMutation.mutate(attachment.id);
                                        }
                                      }}
                                      style={s.deleteBtn}
                                      aria-label="Delete evidence"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                            <label style={s.uploadBtn}>
                              {uploadMutation.isPending ? 'Uploading...' : '+ Upload test file'}
                              <input
                                type="file"
                                hidden
                                disabled={uploadMutation.isPending}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) uploadMutation.mutate({ actionId: action.id, file });
                                  event.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem' },
  title: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' },
  warning: { padding: '0.875rem', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '0.5rem', color: '#92400e', fontSize: '0.875rem', marginBottom: '1rem' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '0.5rem' },
  empty: { padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '960px' },
  th: { padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap' },
  trEven: { backgroundColor: 'var(--color-bg-primary)' },
  trOdd: { backgroundColor: '#f9fafb' },
  td: { padding: '0.6rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' },
  tdRoot: { padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: '#92400e', fontWeight: 600, maxWidth: '220px', borderBottom: '1px solid var(--color-border)' },
  tdDate: { padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' },
  tdCenter: { padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)' },
  tdMuted: { padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', borderBottom: '1px solid var(--color-border)' },
  tdNowrap: { padding: '0.6rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' },
  tdBtn: { padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' },
  activeDot: { color: '#16a34a', fontSize: '1rem' },
  evidenceReady: { color: '#15803d', fontWeight: 700, fontSize: '0.75rem' },
  evidenceMissing: { color: '#b45309', fontWeight: 700, fontSize: '0.75rem' },
  viewBtn: { padding: '0.3rem 0.7rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 },
  evidenceCell: { padding: '0.75rem 1rem', backgroundColor: '#eff6ff', borderBottom: '1px solid var(--color-border)' },
  evidencePanel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
  evidenceList: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' },
  noEvidence: { color: 'var(--color-text-secondary)', fontSize: '0.8rem' },
  fileChip: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.5rem', border: '1px solid #bfdbfe', borderRadius: '999px', backgroundColor: '#fff' },
  fileLink: { color: '#1d4ed8', fontSize: '0.78rem', textDecoration: 'none' },
  deleteBtn: { border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 },
  uploadBtn: { display: 'inline-flex', padding: '0.45rem 0.8rem', borderRadius: '0.35rem', backgroundColor: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' },
};
