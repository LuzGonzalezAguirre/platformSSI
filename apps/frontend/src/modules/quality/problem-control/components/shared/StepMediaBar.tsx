import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../../api/problemApi';
import type { ProblemAttachment, ProblemNote, AttachmentStep } from '../../types/problem.types';

const IconDoc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconImg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

const IconNote = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const IS_IMAGE = /\.(png|jpe?g|gif|bmp|webp)$/i;

const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Props {
  problemId: number;
  step: AttachmentStep;
  readOnly?: boolean;
}

type Tab = 'documents' | 'images' | 'notes';

export const StepMediaBar: React.FC<Props> = ({ problemId, step, readOnly = false }) => {
  const [activeTab, setActiveTab] = useState<Tab>('documents');
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const attachKey = ['attachments', problemId, step];
  const noteKey = ['notes', problemId, step];

  const { data: attachments = [], isLoading: attLoading } = useQuery<ProblemAttachment[]>({
    queryKey: attachKey,
    queryFn: () => problemApi.getAttachments(problemId, step),
    staleTime: 30000,
  });

  const { data: notes = [], isLoading: noteLoading } = useQuery<ProblemNote[]>({
    queryKey: noteKey,
    queryFn: () => problemApi.getNotes(problemId, step),
    staleTime: 30000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => problemApi.uploadAttachment(problemId, step, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachKey }),
    onError: (e: any) => alert(e.response?.data?.detail || e.message),
  });

  const deleteAttMutation = useMutation({
    mutationFn: (id: number) => problemApi.deleteAttachment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachKey }),
    onError: (e: any) => alert(e.response?.data?.detail || e.message),
  });

  const createNoteMutation = useMutation({
    mutationFn: (text: string) => problemApi.createNote(problemId, step, text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: noteKey }); setNoteText(''); },
    onError: (e: any) => alert(e.response?.data?.detail || e.message),
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => problemApi.updateNote(id, text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: noteKey }); setEditingNoteId(null); setEditingText(''); },
    onError: (e: any) => alert(e.response?.data?.detail || e.message),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => problemApi.deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKey }),
    onError: (e: any) => alert(e.response?.data?.detail || e.message),
  });

  const docs = attachments.filter(a => !IS_IMAGE.test(a.filename));
  const imgs = attachments.filter(a => IS_IMAGE.test(a.filename));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    e.target.value = '';
  };

  const handleDeleteAtt = (id: number) => {
    if (!window.confirm('Delete this attachment?')) return;
    deleteAttMutation.mutate(id);
  };

  const handleDeleteNote = (id: number) => {
    if (!window.confirm('Delete this note?')) return;
    deleteNoteMutation.mutate(id);
  };

  const startEditNote = (note: ProblemNote) => {
    setEditingNoteId(note.id);
    setEditingText(note.text);
  };

  const isBusy =
    uploadMutation.isPending || deleteAttMutation.isPending ||
    createNoteMutation.isPending || updateNoteMutation.isPending || deleteNoteMutation.isPending;

  const tabCount = {
    documents: docs.length,
    images: imgs.length,
    notes: notes.length,
  };

  return (
    <div style={s.wrap}>
      {/* Tab bar */}
      <div style={s.tabBar}>
        {(['documents', 'images', 'notes'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }}
          >
            <span style={s.tabIcon}>
              {tab === 'documents' && <IconDoc />}
              {tab === 'images' && <IconImg />}
              {tab === 'notes' && <IconNote />}
            </span>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tabCount[tab] > 0 && <span style={s.badge}>{tabCount[tab]}</span>}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div style={s.panel}>

        {/* ── Documents ── */}
        {activeTab === 'documents' && (
          <>
            {!readOnly && (
              <>
                <button onClick={() => docInputRef.current?.click()} style={s.uploadBtn} disabled={isBusy}>
                  {uploadMutation.isPending ? 'Uploading…' : '+ Upload Document'}
                </button>
                <input ref={docInputRef} type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx"
                  style={{ display: 'none' }} onChange={handleFileChange} />
              </>
            )}
            {attLoading
              ? <p style={s.msg}>Loading…</p>
              : docs.length === 0
                ? <p style={s.msg}>No documents uploaded yet.</p>
                : <div style={s.list}>
                    {docs.map(a => (
                      <div key={a.id} style={s.item}>
                        <span style={s.icon}><IconFile /></span>
                        <div style={s.info}>
                          <a href={a.file} target="_blank" rel="noopener noreferrer" style={s.link}>{a.filename}</a>
                          <div style={s.meta}>{fmtSize(a.file_size)} · {fmtDate(a.uploaded_at)}{a.uploaded_by ? ` · ${a.uploaded_by.first_name} ${a.uploaded_by.last_name}` : ''}</div>
                        </div>
                        {!readOnly && (
                          <button onClick={() => handleDeleteAtt(a.id)} style={s.delBtn} disabled={isBusy} title="Delete">×</button>
                        )}
                      </div>
                    ))}
                  </div>
            }
          </>
        )}

        {/* ── Images ── */}
        {activeTab === 'images' && (
          <>
            {!readOnly && (
              <>
                <button onClick={() => imgInputRef.current?.click()} style={s.uploadBtn} disabled={isBusy}>
                  {uploadMutation.isPending ? 'Uploading…' : '+ Upload Image'}
                </button>
                <input ref={imgInputRef} type="file"
                  accept=".png,.jpg,.jpeg,.gif,.bmp,.webp"
                  style={{ display: 'none' }} onChange={handleFileChange} />
              </>
            )}
            {attLoading
              ? <p style={s.msg}>Loading…</p>
              : imgs.length === 0
                ? <p style={s.msg}>No images uploaded yet.</p>
                : <div style={s.imgGrid}>
                    {imgs.map(a => (
                      <div key={a.id} style={s.imgCard}>
                        <a href={a.file} target="_blank" rel="noopener noreferrer">
                          <img src={a.file} alt={a.filename} style={s.thumb} />
                        </a>
                        <div style={s.imgMeta}>
                          <div style={s.imgName} title={a.filename}>{a.filename}</div>
                          <div style={s.meta}>{fmtSize(a.file_size)}</div>
                        </div>
                        {!readOnly && (
                          <button onClick={() => handleDeleteAtt(a.id)} style={s.delBtnAbs} disabled={isBusy} title="Delete">×</button>
                        )}
                      </div>
                    ))}
                  </div>
            }
          </>
        )}

        {/* ── Notes ── */}
        {activeTab === 'notes' && (
          <>
            {!readOnly && (
              <div style={s.noteForm}>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={3}
                  style={s.noteArea}
                  placeholder="Write a note for this step…"
                />
                <button
                  onClick={() => { if (noteText.trim()) createNoteMutation.mutate(noteText.trim()); }}
                  style={s.saveNoteBtn}
                  disabled={isBusy || !noteText.trim()}
                >
                  {createNoteMutation.isPending ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            )}
            {noteLoading
              ? <p style={s.msg}>Loading…</p>
              : notes.length === 0
                ? <p style={s.msg}>No notes yet.</p>
                : <div style={s.noteList}>
                    {notes.map(n => (
                      <div key={n.id} style={s.noteItem}>
                        {editingNoteId === n.id ? (
                          <>
                            <textarea
                              value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              rows={3}
                              style={s.noteArea}
                            />
                            <div style={s.noteActions}>
                              <button onClick={() => { setEditingNoteId(null); setEditingText(''); }} style={s.cancelBtn} disabled={isBusy}>Cancel</button>
                              <button
                                onClick={() => { if (editingText.trim()) updateNoteMutation.mutate({ id: n.id, text: editingText.trim() }); }}
                                style={s.saveNoteBtn}
                                disabled={isBusy || !editingText.trim()}
                              >
                                {updateNoteMutation.isPending ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={s.noteText}>{n.text}</div>
                            <div style={s.noteMeta}>
                              {fmtDate(n.created_at)} · {n.created_by.first_name} {n.created_by.last_name}
                              {n.updated_at !== n.created_at && ' (edited)'}
                            </div>
                            {!readOnly && (
                              <div style={s.noteActions}>
                                <button onClick={() => startEditNote(n)} style={s.editBtn} disabled={isBusy}>Edit</button>
                                <button onClick={() => handleDeleteNote(n.id)} style={s.delSmBtn} disabled={isBusy}>Delete</button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
            }
          </>
        )}
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrap: { marginTop: '1.5rem', border: '1px solid var(--color-border)', borderRadius: '0.5rem', overflow: 'hidden', backgroundColor: 'var(--color-bg-secondary)' },

  tabBar: { display: 'flex', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)' },
  tab: { padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-secondary)', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'color 0.15s' },
  tabActive: { color: '#3b82f6', borderBottomColor: '#3b82f6', fontWeight: 600 },
  tabIcon: { display: 'flex', alignItems: 'center' },
  badge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '1.125rem', height: '1.125rem', backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '0.65rem', fontWeight: 700, borderRadius: '9999px', padding: '0 0.2rem' },

  panel: { padding: '0.875rem 1rem' },

  uploadBtn: { marginBottom: '0.75rem', padding: '0.375rem 0.875rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' },

  msg: { fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '0.25rem 0' },

  list: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  item: { display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.4rem 0.625rem', backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '0.375rem' },
  icon: { display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  link: { fontSize: '0.8125rem', fontWeight: 500, color: '#3b82f6', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.1rem' },
  delBtn: { flexShrink: 0, width: '1.375rem', height: '1.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '0.25rem', fontSize: '0.9rem', cursor: 'pointer' },

  imgGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.625rem' },
  imgCard: { position: 'relative', width: '7rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', overflow: 'hidden', backgroundColor: 'var(--color-bg-primary)' },
  thumb: { width: '100%', height: '5rem', objectFit: 'cover', display: 'block' },
  imgMeta: { padding: '0.25rem 0.375rem' },
  imgName: { fontSize: '0.65rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  delBtnAbs: { position: 'absolute', top: '0.2rem', right: '0.2rem', width: '1.25rem', height: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(220,38,38,0.85)', color: 'white', border: 'none', borderRadius: '50%', fontSize: '0.8rem', cursor: 'pointer' },

  noteForm: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' },
  noteArea: { width: '100%', padding: '0.5rem 0.625rem', border: '1px solid var(--color-border)', borderRadius: '0.375rem', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', resize: 'vertical', boxSizing: 'border-box' },
  saveNoteBtn: { alignSelf: 'flex-end', padding: '0.375rem 0.875rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' },
  noteList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  noteItem: { padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '0.375rem' },
  noteText: { fontSize: '0.875rem', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', marginBottom: '0.3rem' },
  noteMeta: { fontSize: '0.7rem', color: 'var(--color-text-secondary)' },
  noteActions: { display: 'flex', gap: '0.375rem', marginTop: '0.375rem', justifyContent: 'flex-end' },
  editBtn: { padding: '0.2rem 0.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' },
  delSmBtn: { padding: '0.2rem 0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' },
  cancelBtn: { padding: '0.2rem 0.5rem', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' },
};
