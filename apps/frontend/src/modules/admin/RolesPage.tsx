import { useState, useEffect, useCallback } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { PermissionsService } from "../../services/permissions.service";

const MODULES = [
  { value: "production",     icon: "Factory" },
  { value: "quality",        icon: "BadgeCheck" },
  { value: "maintenance",    icon: "Wrench" },
  { value: "warehouse",      icon: "Warehouse" },
  { value: "administration", icon: "ShieldCheck" },
];

const ACTIONS = ["view", "create", "edit", "delete"];

interface Role {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_system: boolean;
  permissions: string[];
  user_count: number;
}

export default function RolesPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [savedPermissions, setSavedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await PermissionsService.getAllRoles();
      setRoles(data as unknown as Role[]);
      if (!selectedSlug && (data as unknown as Role[]).length > 0) {
        const first = (data as unknown as Role[])[0];
        setSelectedSlug(first.slug);
        setPermissions(first.permissions);
        setSavedPermissions(first.permissions);
      }
    } catch {
      setMsg({ type: "error", text: t("rolesPage.errorLoad") });
    }
  }, [selectedSlug]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const selectRole = (role: Role) => {
    setSelectedSlug(role.slug);
    setPermissions(role.permissions);
    setSavedPermissions(role.permissions);
    setIsDirty(false);
    setMsg(null);
  };

  const togglePermission = (module: string, action: string) => {
    const key = `${module}.${action}`;
    const updated = permissions.includes(key)
      ? permissions.filter((p) => p !== key)
      : [...permissions, key];
    setPermissions(updated);
    setIsDirty(true);
  };

  const toggleModule = (module: string) => {
    const allKeys = ACTIONS.map((a) => `${module}.${a}`);
    const allEnabled = allKeys.every((k) => permissions.includes(k));
    const updated = allEnabled
      ? permissions.filter((p) => !allKeys.includes(p))
      : [...new Set([...permissions, ...allKeys])];
    setPermissions(updated);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedSlug) return;
    setSaving(true);
    setMsg(null);
    try {
      await PermissionsService.setRolePermissions(selectedSlug, permissions);
      setSavedPermissions(permissions);
      setRoles((prev) =>
        prev.map((r) => (r.slug === selectedSlug ? { ...r, permissions } : r))
      );
      setIsDirty(false);
      setMsg({ type: "success", text: t("rolesPage.successSave") });
    } catch {
      setMsg({ type: "error", text: t("rolesPage.errorSave") });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setPermissions(savedPermissions);
    setIsDirty(false);
    setMsg(null);
  };

  const selectedRole = roles.find((r) => r.slug === selectedSlug);
  const roleLabel = (role: Role) => t(`roles.${role.slug}`, { defaultValue: role.name });

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t("rolesPage.title")}</h1>
          <p style={s.pageSubtitle}>{t("rolesPage.subtitle")}</p>
        </div>
        {isDirty && (
          <div style={s.headerActions}>
            <button style={s.discardBtn} onClick={handleDiscard} disabled={saving}>
              <Icons.X size={15} /><span>{t("rolesPage.discard")}</span>
            </button>
            <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? <Icons.Loader2 size={15} /> : <Icons.Save size={15} />}
              <span>{saving ? t("rolesPage.saving") : t("rolesPage.saveChanges")}</span>
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div style={{
          padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", fontSize: "0.875rem",
          color: msg.type === "success" ? "var(--color-running)" : "var(--color-stopped)",
          backgroundColor: msg.type === "success" ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
          border: `1px solid ${msg.type === "success" ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`,
        }}>
          {msg.text}
        </div>
      )}

      <div style={s.layout}>
        <div style={s.roleList}>
          <div style={s.roleListHeader}>Roles ({roles.length})</div>
          {roles.map((role) => (
            <button
              key={role.slug}
              style={{ ...s.roleBtn, ...(selectedSlug === role.slug ? s.roleBtnActive : {}) }}
              onClick={() => selectRole(role)}
            >
              <div style={s.roleBtnInner}>
                <div style={s.roleBtnTop}>
                  {role.is_system ? <Icons.ShieldCheck size={14} /> : <Icons.Shield size={14} />}
                  <span style={s.roleName}>{roleLabel(role)}</span>
                </div>
                <div style={s.roleMeta}>
                  <span>{role.user_count} usuario{role.user_count !== 1 ? "s" : ""}</span>
                  {role.is_system && <span style={s.systemBadge}>sistema</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={s.matrix}>
          <div style={s.matrixHeader}>
            <div style={s.matrixTitle}>
              <Icons.Lock size={18} />
              <span>
                {t("rolesPage.permissionsFor")} {"\u2014"} {selectedRole ? roleLabel(selectedRole) : "..."}
              </span>
              {selectedRole?.is_system && <span style={s.systemTag}>{t("rolesPage.systemRole")}</span>}
            </div>
            <span style={s.permCount}>{permissions.length} {t("rolesPage.activePermissions")}</span>
          </div>

          {loading ? (
            <div style={s.loading}>{t("common.loading")}</div>
          ) : (
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: "200px" }}>{t("rolesPage.columns.module")}</th>
                    {ACTIONS.map((a) => (
                      <th key={a} style={{ ...s.th, textAlign: "center" }}>
                        {t(`permissions.actions.${a}`, { defaultValue: a })}
                      </th>
                    ))}
                    <th style={{ ...s.th, textAlign: "center" }}>{t("rolesPage.columns.all")}</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod) => {
                    const allKeys = ACTIONS.map((a) => `${mod.value}.${a}`);
                    const allEnabled = allKeys.every((k) => permissions.includes(k));
                    const ModIcon = (Icons as any)[mod.icon];
                    return (
                      <tr key={mod.value} style={s.tr}>
                        <td style={s.td}>
                          <div style={s.moduleCell}>
                            <span style={s.moduleIcon}>
                              {ModIcon && <ModIcon size={16} />}
                            </span>
                            <span style={s.moduleLabel}>
                              {t(`nav.sections.${mod.value}`, { defaultValue: mod.value })}
                            </span>
                          </div>
                        </td>
                        {ACTIONS.map((action) => {
                          const key = `${mod.value}.${action}`;
                          const active = permissions.includes(key);
                          return (
                            <td key={action} style={{ ...s.td, textAlign: "center" }}>
                              <button
                                style={{
                                  ...s.checkBtn,
                                  backgroundColor: active ? "var(--color-primary)" : "transparent",
                                  borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                                }}
                                onClick={() => togglePermission(mod.value, action)}
                              >
                                {active && <Icons.Check size={12} color="#fff" />}
                              </button>
                            </td>
                          );
                        })}
                        <td style={{ ...s.td, textAlign: "center" }}>
                          <button
                            style={{
                              ...s.toggleAllBtn,
                              backgroundColor: allEnabled ? "rgba(10,110,189,0.1)" : "transparent",
                              color: allEnabled ? "var(--color-primary)" : "var(--color-text-secondary)",
                            }}
                            onClick={() => toggleModule(mod.value)}
                          >
                            {allEnabled ? <Icons.CheckSquare size={15} /> : <Icons.Square size={15} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={s.legend}>
            <span style={s.legendItem}>
              <span style={{ ...s.legendDot, backgroundColor: "var(--color-primary)" }} />
              {t("rolesPage.allowed")}
            </span>
            <span style={s.legendItem}>
              <span style={{ ...s.legendDot, backgroundColor: "var(--color-border)" }} />
              {t("rolesPage.noAccess")}
            </span>
            {isDirty && (
              <span style={{ fontSize: "0.775rem", color: "var(--color-accent)", marginLeft: "auto" }}>
                {"\u25CF"} {t("rolesPage.unsavedChanges")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:           { display: "flex", flexDirection: "column", gap: "1.5rem" },
  pageHeader:     { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  pageTitle:      { fontSize: "1.4rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  pageSubtitle:   { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  headerActions:  { display: "flex", gap: "0.75rem", alignItems: "center" },
  saveBtn: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "0.6rem 1.25rem", backgroundColor: "var(--color-primary)",
    color: "#fff", border: "none", borderRadius: "var(--radius-md)",
    cursor: "pointer", fontSize: "0.875rem", fontWeight: "600",
  },
  discardBtn: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "0.6rem 1.25rem", backgroundColor: "transparent",
    color: "var(--color-text-secondary)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem",
  },
  layout:         { display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.5rem", alignItems: "start" },
  roleList:       { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  roleListHeader: { padding: "0.875rem 1rem", fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" },
  roleBtn:        { width: "100%", display: "flex", alignItems: "center", padding: "0.75rem 1rem", backgroundColor: "transparent", border: "none", borderBottom: "1px solid var(--color-border)", cursor: "pointer", textAlign: "left" },
  roleBtnActive:  { backgroundColor: "rgba(10,110,189,0.08)", borderLeft: "3px solid var(--color-primary)" },
  roleBtnInner:   { display: "flex", flexDirection: "column", gap: "3px", width: "100%" },
  roleBtnTop:     { display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-text-primary)", fontSize: "0.875rem", fontWeight: "600" },
  roleName:       { flex: 1 },
  roleMeta:       { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  systemBadge:    { fontSize: "0.7rem", padding: "1px 6px", backgroundColor: "rgba(10,110,189,0.1)", color: "var(--color-primary)", borderRadius: "99px", fontWeight: "600" },
  matrix:         { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  matrixHeader:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" },
  matrixTitle:    { display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.95rem", fontWeight: "700", color: "var(--color-text-primary)" },
  systemTag:      { fontSize: "0.75rem", padding: "2px 8px", backgroundColor: "rgba(10,110,189,0.1)", color: "var(--color-primary)", borderRadius: "99px", fontWeight: "600" },
  permCount:      { fontSize: "0.8rem", color: "var(--color-text-secondary)" },
  loading:        { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  tableWrapper:   { overflowX: "auto" },
  table:          { width: "100%", borderCollapse: "collapse" },
  th:             { padding: "0.75rem 1rem", fontSize: "0.775rem", fontWeight: "600", color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)", whiteSpace: "nowrap" },
  tr:             { borderBottom: "1px solid var(--color-border)" },
  td:             { padding: "0.875rem 1rem", verticalAlign: "middle" },
  moduleCell:     { display: "flex", alignItems: "center", gap: "0.625rem" },
  moduleIcon:     { color: "var(--color-text-secondary)", display: "flex" },
  moduleLabel:    { fontSize: "0.875rem", fontWeight: "600", color: "var(--color-text-primary)" },
  checkBtn:       { width: "24px", height: "24px", borderRadius: "var(--radius-sm)", border: "2px solid", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" },
  toggleAllBtn:   { padding: "0.25rem", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" },
  legend:         { display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.5rem", borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" },
  legendItem:     { display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.775rem", color: "var(--color-text-secondary)" },
  legendDot:      { width: "10px", height: "10px", borderRadius: "50%" },
};