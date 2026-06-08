import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useQWallUsers, useQWallRoles,
  useCreateUser, useUpdateUser, useDeactivateUser,
} from "../hooks/useQWallSettings";
import type { QWallUser } from "../types";

type ModalMode = "create" | "edit" | "password";

interface FormState {
  name: string;
  barcode_id: string;
  password_hash: string;
  role_id: number | "";
}

const EMPTY: FormState = { name: "", barcode_id: "", password_hash: "", role_id: "" };

export default function UsersTab() {
  const { t } = useTranslation();
  const { data: users = [], isLoading, error } = useQWallUsers();
  const { data: roles = [] } = useQWallRoles();
  const createUser     = useCreateUser();
  const updateUser     = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  const [search, setSearch]           = useState("");
  const [filterRole, setFilterRole]   = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"1" | "0" | "all">("1");

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode]           = useState<ModalMode>("create");
  const [selected, setSelected]   = useState<QWallUser | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const active      = Boolean(u.is_active);  // BIT llega como true/false o 1/0
      const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                          u.barcode_id.toLowerCase().includes(search.toLowerCase());
      const matchRole   = filterRole === "" || u.role_id === Number(filterRole);
      const matchStatus = filterStatus === "all" ||
                          (filterStatus === "1" ? active : !active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, filterRole, filterStatus]);

  const openCreate = () => {
    setSelected(null); setForm(EMPTY); setMode("create"); setModalOpen(true); setFormError(null);
  };
  const openEdit = (u: QWallUser) => {
    setSelected(u);
    setForm({ name: u.name, barcode_id: u.barcode_id, password_hash: "", role_id: u.role_id });
    setMode("edit"); setModalOpen(true); setFormError(null);
  };
  const openPassword = (u: QWallUser) => {
    setSelected(u);
    setForm({ name: "", barcode_id: "", password_hash: "", role_id: "" });
    setMode("password"); setModalOpen(true); setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "password") {
      if (!form.password_hash) { setFormError(t("qwallSettings.modal.passwordRequired")); return; }
      setSaving(true); setFormError(null);
      try {
        await updateUser.mutateAsync({ user_id: selected!.user_id, body: { password_hash: form.password_hash } });
        setModalOpen(false);
      } catch (err: any) {
        setFormError(err?.response?.data?.error ?? t("qwallSettings.messages.saveError"));
      } finally { setSaving(false); }
      return;
    }

    if (!form.role_id) { setFormError(t("qwallSettings.modal.roleRequired")); return; }
    if (mode === "create" && !form.password_hash) { setFormError(t("qwallSettings.modal.passwordRequired")); return; }

    setSaving(true); setFormError(null);
    try {
      if (mode === "create") {
        await createUser.mutateAsync({
          name: form.name,
          barcode_id: form.barcode_id,
          password_hash: form.password_hash,
          role_id: Number(form.role_id),
        });
      } else if (selected) {
        const body: Parameters<typeof updateUser.mutateAsync>[0]["body"] = {
          name: form.name,
          barcode_id: form.barcode_id,
          role_id: Number(form.role_id),
        };
        await updateUser.mutateAsync({ user_id: selected.user_id, body });
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? t("qwallSettings.messages.saveError"));
    } finally { setSaving(false); }
  };

  const handleToggle = async (u: QWallUser) => {
    if (u.is_active) {
      await deactivateUser.mutateAsync(u.user_id);
    } else {
      await updateUser.mutateAsync({ user_id: u.user_id, body: { is_active: 1 } });
    }
  };

  const modalTitle = mode === "create"
    ? t("qwallSettings.modal.createUser")
    : mode === "edit"
    ? t("qwallSettings.modal.editUser")
    : t("qwallSettings.modal.changePassword");

  return (
    <div style={s.tab}>
      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        <div style={s.searchWrapper}>
          <Icons.Search size={15} style={s.searchIcon} />
          <input
            style={s.searchInput}
            placeholder={t("qwallSettings.buttons.search")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select style={s.filterSelect} value={filterRole} onChange={e => setFilterRole(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">{t("qwallSettings.filter.allRoles")}</option>
          {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
        </select>

        <select style={s.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value as "1" | "0" | "all")}>
          <option value="1">{t("qwallSettings.status.active")}</option>
          <option value="0">{t("qwallSettings.status.inactive")}</option>
          <option value="all">{t("qwallSettings.filter.allStatuses")}</option>
        </select>

        <button style={s.newBtn} onClick={openCreate}>
          <Icons.Plus size={15} /> {t("qwallSettings.buttons.new")}
        </button>
      </div>

      {error && <p style={s.error}>{t("qwallSettings.messages.saveError")}</p>}

      {/* ── Table ── */}
      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t("qwallSettings.columns.name")}</th>
              <th style={s.th}>{t("qwallSettings.columns.pin")}</th>
              <th style={s.th}>{t("qwallSettings.columns.role")}</th>
              <th style={s.th}>{t("qwallSettings.columns.active")}</th>
              <th style={s.th}>{t("qwallSettings.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1,2,3].map(i => (
                <tr key={i}><td colSpan={5} style={s.skeletonCell}><div style={s.skeleton} /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={s.empty}>{t("qwallSettings.messages.noData")}</td></tr>
            ) : filtered.map(u => (
              <tr key={u.user_id} style={s.tr}>
                <td style={s.td}><span style={s.bold}>{u.name}</span></td>
                <td style={s.td}><code style={s.code}>{u.barcode_id}</code></td>
                <td style={s.td}>{u.role_name ?? "—"}</td>
                <td style={s.td}>
                  {(() => {
                    const active = Boolean(u.is_active);
                    return (
                      <span style={{ ...s.badge, ...(active ? s.badgeActive : s.badgeInactive) }}>
                        {active ? t("qwallSettings.status.active") : t("qwallSettings.status.inactive")}
                      </span>
                    );
                  })()}
                </td>
                <td style={s.td}>
                  {(() => {
                    const active = Boolean(u.is_active);
                    return (
                      <div style={s.actions}>
                        <button style={s.actionBtn} onClick={() => openEdit(u)} title={t("qwallSettings.buttons.edit")}>
                          <Icons.Pencil size={14} />
                        </button>
                        <button style={s.actionBtn} onClick={() => openPassword(u)} title={t("qwallSettings.modal.changePassword")}>
                          <Icons.KeyRound size={14} />
                        </button>
                        <button
                          style={{ ...s.actionBtn, color: active ? "var(--color-stopped)" : "var(--color-running)" }}
                          onClick={() => handleToggle(u)}
                          title={active ? t("qwallSettings.buttons.deactivate") : t("qwallSettings.buttons.activate")}
                        >
                          {active ? <Icons.UserX size={14} /> : <Icons.UserCheck size={14} />}
                        </button>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{modalTitle}</h3>
              <button style={s.closeBtn} onClick={() => setModalOpen(false)}><Icons.X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              {/* Create / Edit fields */}
              {mode !== "password" && (
                <>
                  <div style={s.field}>
                    <label style={s.label}>{t("qwallSettings.columns.name")} *</label>
                    <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{t("qwallSettings.columns.pin")} *</label>
                    <input style={s.input} value={form.barcode_id} onChange={e => setForm(f => ({ ...f, barcode_id: e.target.value }))} required />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{t("qwallSettings.columns.role")} *</label>
                    <select style={s.input} value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: Number(e.target.value) }))} required>
                      <option value="">—</option>
                      {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Password field: required on create, shown on password mode */}
              {(mode === "create" || mode === "password") && (
                <div style={s.field}>
                  <label style={s.label}>{t("qwallSettings.modal.password")} *</label>
                  <input
                    style={s.input}
                    type="password"
                    value={form.password_hash}
                    onChange={e => setForm(f => ({ ...f, password_hash: e.target.value }))}
                    placeholder={mode === "password" ? t("qwallSettings.modal.newPassword") : ""}
                    required
                  />
                </div>
              )}

              {formError && <p style={s.formError}>{formError}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setModalOpen(false)}>{t("qwallSettings.buttons.cancel")}</button>
                <button type="submit" style={s.saveBtn} disabled={saving}>
                  {saving ? t("qwallSettings.buttons.saving") : t("qwallSettings.buttons.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tab:          { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:      { display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" },
  searchWrapper:{ position: "relative", flex: 1, minWidth: "160px" },
  searchIcon:   { position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" },
  searchInput:  { width: "100%", padding: "0.55rem 0.75rem 0.55rem 2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", boxSizing: "border-box" },
  filterSelect: { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "130px" },
  newBtn:       { display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", whiteSpace: "nowrap" },
  error:        { color: "var(--color-stopped)", fontSize: "0.85rem" },
  tableWrapper: { overflowX: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th:           { padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  tr:           { borderBottom: "1px solid var(--color-border)" },
  td:           { padding: "0.75rem 1rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  bold:         { fontWeight: "600" },
  code:         { fontFamily: "monospace", fontSize: "0.85rem", color: "var(--color-text-secondary)" },
  badge:        { padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "600" },
  badgeActive:  { backgroundColor: "rgba(22,163,74,0.1)", color: "var(--color-running)" },
  badgeInactive:{ backgroundColor: "rgba(220,38,38,0.1)", color: "var(--color-stopped)" },
  actions:      { display: "flex", gap: "0.375rem" },
  actionBtn:    { display: "flex", alignItems: "center", padding: "0.35rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-text-secondary)" },
  empty:        { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  skeletonCell: { padding: "0.75rem 1rem" },
  skeleton:     { height: "1rem", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-border)", animation: "pulse 1.5s infinite" },
  overlay:      { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  modal:        { backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  modalTitle:   { fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  closeBtn:     { background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex" },
  form:         { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
  field:        { display: "flex", flexDirection: "column", gap: "0.35rem" },
  label:        { fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-primary)" },
  input:        { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  formError:    { color: "var(--color-stopped)", fontSize: "0.82rem", padding: "0.4rem 0.6rem", backgroundColor: "rgba(220,38,38,0.08)", borderRadius: "var(--radius-sm)" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" },
  cancelBtn:    { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-secondary)" },
  saveBtn:      { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "none", backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
};
