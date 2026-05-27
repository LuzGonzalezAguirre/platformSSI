import { useState, useEffect, useCallback } from "react";
import * as Icons from "lucide-react";
import { auditApi, UserActivity, AuditLog, AuditLogFilters } from "./auditApi";

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Hace un momento";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `Hace ${Math.floor(diff / 86400)} días`;
  return new Date(dateStr).toLocaleDateString("es-MX");
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  CREATE: "Crear",
  UPDATE: "Editar",
  DELETE: "Eliminar",
};

const MODULE_LABELS: Record<string, string> = {
  identity: "Usuarios",
  quality: "Calidad",
  production: "Producción",
  maintenance: "Mantenimiento",
  warehouse: "Almacén",
  manufacturing: "Manufactura",
  permissions: "Permisos",
};

// ─── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, React.CSSProperties> = {
    LOGIN:  { backgroundColor: "rgba(10,110,189,0.12)", color: "var(--color-primary)" },
    LOGOUT: { backgroundColor: "rgba(100,100,100,0.12)", color: "var(--color-text-secondary)" },
    CREATE: { backgroundColor: "rgba(22,163,74,0.12)", color: "var(--color-running)" },
    UPDATE: { backgroundColor: "rgba(234,179,8,0.12)", color: "#ca8a04" },
    DELETE: { backgroundColor: "rgba(220,38,38,0.12)", color: "var(--color-stopped)" },
  };
  return (
    <span style={{ ...s.badge, ...(colors[action] ?? {}) }}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

// ─── Tab: usuarios ────────────────────────────────────────────────────────────

function UsersTab({ onViewUser }: { onViewUser: (userId: string) => void }) {
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    auditApi.getUserActivity()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) =>
    !search ||
    u.employee_id.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.tabContent}>
      <div style={s.searchWrapper}>
        <Icons.Search size={15} style={s.searchIcon} />
        <input
          style={s.searchInput}
          placeholder="Buscar por nombre o número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Empleado</th>
              <th style={s.th}>Nombre</th>
              <th style={s.th}>Planta</th>
              <th style={s.th}>Estado</th>
              <th style={s.th}>Último login</th>
              <th style={s.th}>Última acción</th>
              <th style={s.th}>Acciones (30d)</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={s.emptyCell}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={s.emptyCell}>No hay usuarios.</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} style={s.tr}>
                <td style={s.td}>
                  <span style={s.mono}>#{u.employee_id}</span>
                </td>
                <td style={s.td}>
                  <span style={s.userName}>{u.full_name || "—"}</span>
                </td>
                <td style={s.td}>{u.plant || "—"}</td>
                <td style={s.td}>
                  <span style={{
                    ...s.badge,
                    backgroundColor: u.is_active ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
                    color: u.is_active ? "var(--color-running)" : "var(--color-stopped)",
                  }}>
                    {u.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={s.secondary} title={u.last_login_at ?? ""}>
                    {timeAgo(u.last_login_at)}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={s.secondary} title={u.last_action_at ?? ""}>
                    {timeAgo(u.last_action_at)}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{
                    ...s.badge,
                    backgroundColor: "rgba(10,110,189,0.08)",
                    color: "var(--color-primary)",
                  }}>
                    {u.total_actions}
                  </span>
                </td>
                <td style={s.td}>
                  <button
                    style={s.linkBtn}
                    onClick={() => onViewUser(String(u.id))}
                    title="Ver actividad"
                  >
                    <Icons.Activity size={14} />
                    <span>Ver</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: actividad ───────────────────────────────────────────────────────────

const ACTIONS = ["LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE"];
const MODULES = ["identity", "quality", "production", "maintenance", "warehouse", "manufacturing", "permissions"];

function ActivityTab({ initialUserId }: { initialUserId?: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({
    user_id: initialUserId ?? "",
    action: "",
    module: "",
    date_from: "",
    date_to: "",
    search: "",
    page: 1,
  });

  const load = useCallback((f: AuditLogFilters) => {
    setLoading(true);
    auditApi.getAuditLogs(f)
      .then((data) => { setLogs(data.results); setCount(data.count); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(filters); }, []);

  useEffect(() => {
    if (initialUserId) {
      const next = { ...filters, user_id: initialUserId, page: 1 };
      setFilters(next);
      load(next);
    }
  }, [initialUserId]);

  const applyFilters = () => load({ ...filters, page: 1 });
  const clearFilters = () => {
    const cleared = { user_id: "", action: "", module: "", date_from: "", date_to: "", search: "", page: 1 };
    setFilters(cleared);
    load(cleared);
  };
  const totalPages = Math.ceil(count / 50);

  return (
    <div style={s.tabContent}>
      {/* Filters */}
      <div style={s.filtersRow}>
        <div style={s.searchWrapper}>
          <Icons.Search size={15} style={s.searchIcon} />
          <input
            style={s.searchInput}
            placeholder="Buscar usuario..."
            value={filters.search ?? ""}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>

        <select
          style={s.select}
          value={filters.action ?? ""}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        >
          <option value="">Todas las acciones</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </select>

        <select
          style={s.select}
          value={filters.module ?? ""}
          onChange={(e) => setFilters({ ...filters, module: e.target.value })}
        >
          <option value="">Todos los módulos</option>
          {MODULES.map((m) => (
            <option key={m} value={m}>{MODULE_LABELS[m] ?? m}</option>
          ))}
        </select>

        <input
          type="date"
          style={s.dateInput}
          value={filters.date_from ?? ""}
          onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
        />
        <input
          type="date"
          style={s.dateInput}
          value={filters.date_to ?? ""}
          onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
        />

        <button style={s.applyBtn} onClick={applyFilters}>Filtrar</button>
        <button style={s.clearBtn} onClick={clearFilters}>Limpiar</button>
      </div>

      <div style={{ ...s.secondary, fontSize: "0.8rem", marginBottom: "0.5rem" }}>
        {count} registro{count !== 1 ? "s" : ""}
      </div>

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Fecha / Hora</th>
              <th style={s.th}>Usuario</th>
              <th style={s.th}>Acción</th>
              <th style={s.th}>Módulo</th>
              <th style={s.th}>Detalle</th>
              <th style={s.th}>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={s.emptyCell}>Cargando...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={s.emptyCell}>Sin registros.</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} style={s.tr}>
                <td style={s.td}>
                  <span style={s.mono}>{formatDateTime(log.timestamp)}</span>
                </td>
                <td style={s.td}>
                  <div style={s.userName}>{log.user_name}</div>
                  <div style={s.secondary}>#{log.user_employee_id}</div>
                </td>
                <td style={s.td}>
                  <ActionBadge action={log.action} />
                </td>
                <td style={s.td}>
                  {MODULE_LABELS[log.module] ?? (log.module || "—")}
                </td>
                <td style={s.td}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    {(log.resource || log.resource_id) ? (
                      <span style={s.mono}>
                        {log.resource}{log.resource_id ? ` #${log.resource_id}` : ""}
                      </span>
                    ) : null}
                    {log.description ? (
                      <span
                        style={{ ...s.secondary, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={log.description}
                      >
                        {log.description}
                      </span>
                    ) : null}
                    {!log.resource && !log.resource_id && !log.description && "—"}
                  </div>
                </td>
                <td style={s.td}>
                  <span style={s.mono}>{log.ip_address ?? "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button
            style={s.pageBtn}
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => { const next = { ...filters, page: (filters.page ?? 1) - 1 }; setFilters(next); load(next); }}
          >
            <Icons.ChevronLeft size={14} />
          </button>
          <span style={s.secondary}>
            Página {filters.page ?? 1} de {totalPages}
          </span>
          <button
            style={s.pageBtn}
            disabled={(filters.page ?? 1) >= totalPages}
            onClick={() => { const next = { ...filters, page: (filters.page ?? 1) + 1 }; setFilters(next); load(next); }}
          >
            <Icons.ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<"users" | "activity">("users");
  const [jumpUserId, setJumpUserId] = useState<string | undefined>();

  const handleViewUser = (userId: string) => {
    setJumpUserId(userId);
    setActiveTab("activity");
  };

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Auditoría de Usuarios</h1>
          <p style={s.pageSubtitle}>Última conexión y movimientos por usuario</p>
        </div>
      </div>

      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(activeTab === "users" ? s.tabActive : {}) }}
          onClick={() => setActiveTab("users")}
        >
          <Icons.Users size={15} />
          <span>Usuarios</span>
        </button>
        <button
          style={{ ...s.tab, ...(activeTab === "activity" ? s.tabActive : {}) }}
          onClick={() => { setJumpUserId(undefined); setActiveTab("activity"); }}
        >
          <Icons.Activity size={15} />
          <span>Actividad</span>
        </button>
      </div>

      {activeTab === "users" && <UsersTab onViewUser={handleViewUser} />}
      {activeTab === "activity" && <ActivityTab initialUserId={jumpUserId} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:         { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pageHeader:   { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  pageTitle:    { fontSize: "1.4rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  pageSubtitle: { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },

  tabs: { display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0" },
  tab: {
    display: "flex", alignItems: "center", gap: "0.4rem",
    padding: "0.6rem 1.1rem", background: "none", border: "none",
    cursor: "pointer", fontSize: "0.875rem", fontWeight: "500",
    color: "var(--color-text-secondary)", borderBottom: "2px solid transparent",
    marginBottom: "-1px",
  },
  tabActive: {
    color: "var(--color-primary)",
    borderBottomColor: "var(--color-primary)",
    fontWeight: "600",
  },

  tabContent:   { display: "flex", flexDirection: "column", gap: "0.75rem" },
  filtersRow:   { display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" },
  searchWrapper:{ position: "relative", flex: 1, minWidth: "180px" },
  searchIcon:   { position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" },
  searchInput:  { width: "100%", padding: "0.55rem 0.75rem 0.55rem 2.2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", boxSizing: "border-box" },
  select:       { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "140px" },
  dateInput:    { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  applyBtn:     { padding: "0.55rem 1rem", borderRadius: "var(--radius-md)", border: "none", backgroundColor: "var(--color-primary)", color: "#fff", fontSize: "0.875rem", fontWeight: "600", cursor: "pointer" },
  clearBtn:     { padding: "0.55rem 0.8rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", backgroundColor: "transparent", color: "var(--color-text-secondary)", fontSize: "0.875rem", cursor: "pointer" },

  tableWrapper: { overflowX: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th:           { padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  tr:           { borderBottom: "1px solid var(--color-border)" },
  td:           { padding: "0.8rem 1rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  emptyCell:    { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },

  badge:    { padding: "0.2rem 0.65rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "600", whiteSpace: "nowrap" },
  mono:     { fontFamily: "monospace", fontSize: "0.82rem", color: "var(--color-text-secondary)" },
  secondary:{ color: "var(--color-text-secondary)", fontSize: "0.8rem" },
  userName: { fontWeight: "600", color: "var(--color-text-primary)", fontSize: "0.875rem" },

  linkBtn: {
    display: "flex", alignItems: "center", gap: "0.3rem",
    padding: "0.3rem 0.6rem", background: "none",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
    cursor: "pointer", color: "var(--color-primary)", fontSize: "0.8rem", fontWeight: "600",
  },

  pagination: { display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "center", paddingTop: "0.5rem" },
  pageBtn:    { display: "flex", alignItems: "center", padding: "0.4rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-text-secondary)" },
};
