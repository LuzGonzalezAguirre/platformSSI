import { useState } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUsers } from "./useUsers";
import UserModal from "./UserModal";
import { User } from "../../services/users.service";


type ModalMode = "create" | "edit" | "reset-password";

export default function UsersPage() {
  const { t } = useTranslation();
  const {
    users, roles, loading, error,
    filters, setFilters,
    createUser, updateUser, toggleActive, resetPassword,
  } = useUsers();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const openCreate = () => { setSelectedUser(null); setModalMode("create"); setModalOpen(true); };
  const openEdit = (user: User) => { setSelectedUser(user); setModalMode("edit"); setModalOpen(true); };
  const openResetPassword = (user: User) => { setSelectedUser(user); setModalMode("reset-password"); setModalOpen(true); };

  const handleSubmit = async (data: any) => {
    if (modalMode === "create") await createUser(data);
    else if (modalMode === "edit" && selectedUser) await updateUser(selectedUser.id, data);
    else if (modalMode === "reset-password" && selectedUser) await resetPassword(selectedUser.id, data.new_password, data.confirm_password);
  };

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t("users.title")}</h1>
          <p style={s.pageSubtitle}>
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button style={s.createBtn} onClick={openCreate}>
          <Icons.UserPlus size={16} />
          <span>{t("users.newUser")}</span>
        </button>
      </div>

      <div style={s.filters}>
        <div style={s.searchWrapper}>
          <Icons.Search size={16} style={s.searchIcon} />
          <input
            style={s.searchInput}
            placeholder={t("users.searchPlaceholder")}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select
          style={s.filterSelect}
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
        >
          <option value="">{t("users.allRoles")}</option>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {t(`roles.${r.value}`, { defaultValue: r.label })}
            </option>
          ))}
        </select>
        <select
          style={s.filterSelect}
          value={filters.is_active}
          onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
        >
          <option value="">{t("users.allStatuses")}</option>
          <option value="true">{t("users.active")}</option>
          <option value="false">{t("users.inactive")}</option>
        </select>
      </div>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t("users.columns.employee")}</th>
              <th style={s.th}>{t("users.columns.name")}</th>
              <th style={s.th}>{t("users.columns.role")}</th>
              <th style={s.th}>{t("users.columns.plant")}</th>
              <th style={s.th}>{t("users.columns.status")}</th>
              <th style={s.th}>{t("users.columns.lastAccess")}</th>
              <th style={s.th}>{t("users.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={s.emptyCell}>{t("common.loading")}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={s.emptyCell}>No se encontraron usuarios.</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} style={s.tr}>
                  <td style={s.td}>
                    <span style={s.employeeId}>#{user.employee_id}</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.userName}>{user.full_name || "—"}</div>
                    {user.email && <div style={s.userEmail}>{user.email}</div>}
                  </td>
                  <td style={s.td}>
                    <div style={s.roleList}>
                      {user.roles?.length > 0 ? (
                        user.roles.map((r) => (
                          <span key={r.slug} style={s.roleBadge}>
                            {t(`roles.${r.slug}`, { defaultValue: r.name })}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={s.td}>
                    {user.plant || <span style={{ color: "var(--color-text-secondary)" }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.statusBadge,
                      backgroundColor: user.is_active ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
                      color: user.is_active ? "var(--color-running)" : "var(--color-stopped)",
                    }}>
                      {user.is_active ? t("users.active") : t("users.inactive")}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString("es-MX")
                        : t("users.never")}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button style={s.actionBtn} onClick={() => openEdit(user)} title={t("users.modal.editTitle")}>
                        <Icons.Pencil size={15} />
                      </button>
                      <button style={s.actionBtn} onClick={() => openResetPassword(user)} title={t("users.modal.resetPasswordTitle")}>
                        <Icons.KeyRound size={15} />
                      </button>
                      <button
                        style={{
                          ...s.actionBtn,
                          color: user.is_active ? "var(--color-stopped)" : "var(--color-running)",
                        }}
                        onClick={() => toggleActive(user.id)}
                      >
                        {user.is_active ? <Icons.UserX size={15} /> : <Icons.UserCheck size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <UserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        user={selectedUser}
        roles={roles}
        mode={modalMode}
      />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:        { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pageHeader:  { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  pageTitle:   { fontSize: "1.4rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  pageSubtitle:{ fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  createBtn: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "0.6rem 1.25rem", backgroundColor: "var(--color-primary)",
    color: "#ffffff", border: "none", borderRadius: "var(--radius-md)",
    cursor: "pointer", fontSize: "0.875rem", fontWeight: "600",
  },
  filters:      { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  searchWrapper:{ position: "relative", flex: 1, minWidth: "200px" },
  searchIcon:   { position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" },
  searchInput:  { width: "100%", padding: "0.6rem 0.75rem 0.6rem 2.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", boxSizing: "border-box" },
  filterSelect: { padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "160px" },
  error:        { color: "var(--color-stopped)", fontSize: "0.875rem" },
  tableWrapper: { overflowX: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th:           { padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.775rem", fontWeight: "600", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  tr:           { borderBottom: "1px solid var(--color-border)" },
  td:           { padding: "0.875rem 1rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  emptyCell:    { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  employeeId:   { fontFamily: "monospace", fontSize: "0.825rem", color: "var(--color-text-secondary)" },
  userName:     { fontWeight: "600", color: "var(--color-text-primary)" },
  userEmail:    { fontSize: "0.775rem", color: "var(--color-text-secondary)" },
  roleList:     { display: "flex", flexWrap: "wrap", gap: "0.25rem" },
  roleBadge:    { padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: "600", backgroundColor: "rgba(10,110,189,0.1)", color: "var(--color-primary)", whiteSpace: "nowrap" },
  statusBadge:  { padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: "600" },
  actions:      { display: "flex", gap: "0.375rem" },
  actionBtn:    { display: "flex", alignItems: "center", padding: "0.375rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-text-secondary)" },
};