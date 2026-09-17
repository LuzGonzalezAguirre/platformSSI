import React, { useEffect, useState } from 'react';
import apiClient from '../../../../../services/api.client';
import { problemApi } from '../../api/problemApi';
import type { UserBasic } from '../../types/problem.types';

interface SettingsPayload {
  quality_manager: UserBasic | null;
  updated_at: string | null;
  updated_by: UserBasic | null;
  can_edit: boolean;
}

export const QualityManagerSettings: React.FC = () => {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [users, setUsers] = useState<UserBasic[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsResponse, approvalUsers] = await Promise.all([
        apiClient.get('/quality/problem-control-settings/'),
        problemApi.getApprovalUsers(),
      ]);
      const settings = settingsResponse.data as SettingsPayload;
      setData(settings);
      setUsers(Array.isArray(approvalUsers) ? approvalUsers : []);
      setSelectedId(settings.quality_manager?.id || '');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || error.message || 'Unable to load approval settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiClient.put('/quality/problem-control-settings/', {
        quality_manager_id: selectedId || null,
      });
      const updated = response.data as SettingsPayload;
      setData(updated);
      setSelectedId(updated.quality_manager?.id || '');
      setMessage({ type: 'success', text: 'Default Quality Manager updated successfully.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || error.message || 'Unable to save approval settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={s.state}>Loading approval settings...</div>;

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <div>
          <h3 style={s.title}>Quality Manager Assignment</h3>
          <p style={s.help}>
            This manager is used automatically as the Quality approval owner for every Problem Control 8D.
            Only administrators can change this assignment.
          </p>
        </div>
        <span style={data?.can_edit ? s.adminBadge : s.readOnlyBadge}>
          {data?.can_edit ? 'Admin editable' : 'Read only'}
        </span>
      </div>

      {message && <div style={message.type === 'success' ? s.success : s.error}>{message.text}</div>}

      <div style={s.card}>
        <label style={s.label}>Default Quality Manager</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
          disabled={!data?.can_edit || saving}
          style={{ ...s.select, ...(!data?.can_edit ? s.disabled : {}) }}
        >
          <option value="">Select Quality Manager...</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.first_name} {user.last_name}{user.job_title ? ` · ${user.job_title}` : ''}
            </option>
          ))}
        </select>

        {data?.quality_manager ? (
          <div style={s.currentBox}>
            <div style={s.currentLabel}>Currently assigned</div>
            <div style={s.currentName}>{data.quality_manager.first_name} {data.quality_manager.last_name}</div>
            <div style={s.currentMeta}>{data.quality_manager.job_title || data.quality_manager.email}</div>
          </div>
        ) : (
          <div style={s.warning}>No Quality Manager is configured yet. Final 8D Quality approval will remain unavailable until an Admin assigns one.</div>
        )}

        {data?.can_edit && (
          <div style={s.actions}>
            <button type="button" onClick={save} disabled={saving} style={s.saveBtn}>
              {saving ? 'Saving...' : 'Save Quality Manager'}
            </button>
          </div>
        )}
      </div>

      {data?.updated_at && (
        <div style={s.audit}>
          Last updated {new Date(data.updated_at).toLocaleString()}
          {data.updated_by ? ` by ${data.updated_by.first_name} ${data.updated_by.last_name}` : ''}.
        </div>
      )}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  state: { padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' },
  title: { margin: 0, fontSize: '1rem', color: 'var(--color-text-primary)' },
  help: { margin: '0.35rem 0 0', maxWidth: '680px', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' },
  adminBadge: { padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#dcfce7', color: '#166534', fontSize: '0.72rem', fontWeight: 700 },
  readOnlyBadge: { padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 700 },
  card: { padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '0.65rem', background: 'var(--color-bg-secondary)' },
  label: { display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' },
  select: { width: '100%', maxWidth: '520px', padding: '0.55rem 0.65rem', border: '1px solid var(--color-border)', borderRadius: '0.4rem', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' },
  disabled: { opacity: 0.7, cursor: 'not-allowed' },
  currentBox: { marginTop: '1rem', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe', background: '#eff6ff' },
  currentLabel: { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#1d4ed8' },
  currentName: { marginTop: '0.2rem', fontSize: '0.92rem', fontWeight: 700, color: '#1e3a8a' },
  currentMeta: { marginTop: '0.15rem', fontSize: '0.78rem', color: '#475569' },
  warning: { marginTop: '1rem', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e', fontSize: '0.8rem' },
  actions: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' },
  saveBtn: { padding: '0.5rem 0.9rem', border: 'none', borderRadius: '0.4rem', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  success: { padding: '0.7rem 0.85rem', borderRadius: '0.45rem', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: '0.8rem' },
  error: { padding: '0.7rem 0.85rem', borderRadius: '0.45rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: '0.8rem' },
  audit: { fontSize: '0.75rem', color: 'var(--color-text-secondary)' },
};
