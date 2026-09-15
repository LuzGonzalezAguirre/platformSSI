import React, { useEffect, useState } from 'react';

export interface CatalogItem {
  id: number;
  key: string;
  label: string;
  is_active: boolean;
}

interface CatalogSettingsProps {
  title: string;
  keyLabel: string;
  labelLabel: string;

  loadItems: () => Promise<CatalogItem[]>;

  createItem: (data: {
    key: string;
    label: string;
    is_active: boolean;
  }) => Promise<void>;

  updateItem: (
    id: number,
    data: {
      label?: string;
      is_active?: boolean;
    }
  ) => Promise<void>;
}

export const CatalogSettings: React.FC<CatalogSettingsProps> = ({
  title,
  keyLabel,
  labelLabel,
  loadItems,
  createItem,
  updateItem,
}) => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const refresh = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await loadItems();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    const key = newKey.trim();
    const label = newLabel.trim();

    if (!key || !label) {
      setError(`${keyLabel} and ${labelLabel} are required.`);
      return;
    }

    try {
      setSaving(true);
      setError('');

      await createItem({
        key,
        label,
        is_active: true,
      });

      setNewKey('');
      setNewLabel('');

      await refresh();
    } catch (err) {
      console.error(err);
      setError('Unable to create item.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditingLabel(item.label);
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingLabel('');
  };

  const saveEdit = async (item: CatalogItem) => {
    const label = editingLabel.trim();

    if (!label) {
      setError(`${labelLabel} is required.`);
      return;
    }

    try {
      setSaving(true);
      setError('');

      await updateItem(item.id, {
        label,
      });

      setEditingId(null);
      setEditingLabel('');

      await refresh();
    } catch (err) {
      console.error(err);
      setError('Unable to update item.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: CatalogItem) => {
    try {
      setSaving(true);
      setError('');

      await updateItem(item.id, {
        is_active: !item.is_active,
      });

      await refresh();
    } catch (err) {
      console.error(err);
      setError('Unable to update item status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={styles.topRow}>
        <div>
          <h3 style={styles.title}>{title}</h3>

          <p style={styles.description}>
            Add, edit, activate or deactivate catalog values.
          </p>
        </div>
      </div>

      <div style={styles.createBox}>
        <div style={styles.field}>
          <label style={styles.label}>
            {keyLabel}
          </label>

          <input
            value={newKey}
            onChange={(e) =>
              setNewKey(e.target.value)
            }
            placeholder={keyLabel}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            {labelLabel}
          </label>

          <input
            value={newLabel}
            onChange={(e) =>
              setNewLabel(e.target.value)
            }
            placeholder={labelLabel}
            style={styles.input}
          />
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          style={styles.addButton}
        >
          + Add
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={styles.message}>
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div style={styles.message}>
          No records found.
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  {keyLabel}
                </th>

                <th style={styles.th}>
                  {labelLabel}
                </th>

                <th style={styles.th}>
                  Status
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign: 'right',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => {
                const editing =
                  editingId === item.id;

                return (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <code style={styles.code}>
                        {item.key}
                      </code>
                    </td>

                    <td style={styles.td}>
                      {editing ? (
                        <input
                          value={editingLabel}
                          onChange={(e) =>
                            setEditingLabel(
                              e.target.value
                            )
                          }
                          style={styles.input}
                          autoFocus
                        />
                      ) : (
                        item.label
                      )}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.status,
                          ...(item.is_active
                            ? styles.active
                            : styles.inactive),
                        }}
                      >
                        {item.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </td>

                    <td
                      style={{
                        ...styles.td,
                        textAlign: 'right',
                      }}
                    >
                      <div style={styles.actions}>
                        {editing ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                saveEdit(item)
                              }
                              disabled={saving}
                              style={styles.saveButton}
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              style={styles.secondaryButton}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(item)
                              }
                              disabled={saving}
                              style={styles.secondaryButton}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleActive(item)
                              }
                              disabled={saving}
                              style={
                                item.is_active
                                  ? styles.deactivateButton
                                  : styles.activateButton
                              }
                            >
                              {item.is_active
                                ? 'Deactivate'
                                : 'Activate'}
                            </button>
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
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },

  title: {
    margin: 0,
    fontSize: '1.05rem',
    color: 'var(--color-text-primary)',
  },

  description: {
    margin: '0.25rem 0 0',
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
  },

  createBox: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr auto',
    gap: '0.75rem',
    alignItems: 'end',
    padding: '1rem',
    marginBottom: '1rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },

  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
  },

  addButton: {
    padding: '0.65rem 1rem',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },

  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },

  th: {
    padding: '0.75rem',
    textAlign: 'left',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    borderBottom: '1px solid var(--color-border)',
  },

  td: {
    padding: '0.75rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    borderBottom: '1px solid var(--color-border)',
  },

  code: {
    fontSize: '0.8rem',
  },

  status: {
    display: 'inline-block',
    padding: '0.25rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },

  active: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: '#16a34a',
  },

  inactive: {
    backgroundColor: 'rgba(107, 114, 128, 0.12)',
    color: 'var(--color-text-secondary)',
  },

  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
  },

  saveButton: {
    padding: '0.45rem 0.75rem',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '0.45rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },

  deactivateButton: {
    padding: '0.45rem 0.75rem',
    border: '1px solid #dc2626',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: '#dc2626',
    cursor: 'pointer',
  },

  activateButton: {
    padding: '0.45rem 0.75rem',
    border: '1px solid #16a34a',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: '#16a34a',
    cursor: 'pointer',
  },

  error: {
    marginBottom: '1rem',
    padding: '0.75rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    color: '#dc2626',
    fontSize: '0.85rem',
  },

  message: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
};