import React, { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../../api/problemApi';
import type { ProblemAttachment, AttachmentStep } from '../../types/problem.types';

interface AttachmentSectionProps {
  problemId: number;
  step: AttachmentStep;
}

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.bmp,.webp';

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const AttachmentSection: React.FC<AttachmentSectionProps> = ({ problemId, step }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: attachments = [], isLoading } = useQuery<ProblemAttachment[]>({
    queryKey: ['attachments', problemId, step],
    queryFn: () => problemApi.getAttachments(problemId, step),
    enabled: !!problemId,
    staleTime: 30000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => problemApi.uploadAttachment(problemId, step, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', problemId, step] }),
    onError: (e: any) => alert(e.response?.data?.detail || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => problemApi.deleteAttachment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', problemId, step] }),
    onError: (e: any) => alert(e.response?.data?.detail || e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    e.target.value = '';
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Delete this attachment?')) return;
    deleteMutation.mutate(id);
  };

  const isBusy = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Attachments</span>
        <button
          onClick={() => inputRef.current?.click()}
          style={s.uploadBtn}
          disabled={isBusy}
        >
          {uploadMutation.isPending ? 'Uploading…' : '+ Upload File'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {isLoading && <p style={s.msg}>Loading attachments…</p>}

      {!isLoading && attachments.length === 0 && (
        <p style={s.msg}>No attachments yet. Upload a file above.</p>
      )}

      {attachments.length > 0 && (
        <div style={s.list}>
          {attachments.map(att => (
            <div key={att.id} style={s.item}>
              <div style={s.fileIcon}>
                {/\.(png|jpe?g|gif|bmp|webp)$/i.test(att.filename) ? '🖼' : '📄'}
              </div>
              <div style={s.info}>
                <a
                  href={att.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.filename}
                >
                  {att.filename}
                </a>
                <div style={s.meta}>
                  {fmtSize(att.file_size)} · {fmtDate(att.uploaded_at)}
                  {att.uploaded_by && ` · ${att.uploaded_by.first_name} ${att.uploaded_by.last_name}`}
                </div>
              </div>
              <button
                onClick={() => handleDelete(att.id)}
                style={s.deleteBtn}
                disabled={isBusy}
                title="Delete attachment"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '1.25rem',
    padding: '1rem',
    backgroundColor: 'var(--color-bg)',
    border: '1px dashed var(--color-border)',
    borderRadius: 'var(--radius-md)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  title: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flex: 1,
  },
  uploadBtn: {
    padding: '0.3rem 0.75rem',
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  msg: {
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
    margin: 0,
  },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
  },
  fileIcon: { fontSize: '1.25rem', flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  filename: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    marginTop: '0.125rem',
  },
  deleteBtn: {
    flexShrink: 0,
    width: '1.5rem',
    height: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
};
