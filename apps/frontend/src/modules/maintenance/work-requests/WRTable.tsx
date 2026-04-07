import { useState, useMemo } from "react";
import { WorkRequest } from "./types";

interface Props { rows: WorkRequest[]; lang: string; }

const STATUS_COLOR: Record<string, string> = {
  completed: "#10b981", complete: "#10b981",
  "in progress": "#f59e0b", pending: "#ef4444", open: "#3b82f6",
};
function sColor(s: string) {
  const k = s.toLowerCase();
  return Object.entries(STATUS_COLOR).find(([key]) => k.includes(key))?.[1] ?? "#6b7280";
}

export default function WRTable({ rows, lang }: Props) {
  const l = lang === "es";
  const [search,     setSearch]     = useState("");
  const [filterSt,   setFilterSt]   = useState("");
  const [filterEq,   setFilterEq]   = useState("");
  const [sortField,  setSortField]  = useState<keyof WorkRequest>("request_date");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc");

  const statuses   = [...new Set(rows.map((r) => r.status))].sort();
  const equipments = [...new Set(rows.map((r) => r.equipment_id).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    let result = rows;
    if (search)   result = result.filter((r) =>
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.work_request_no.toString().includes(search) ||
      r.assigned_to.toLowerCase().includes(search.toLowerCase())
    );
    if (filterSt) result = result.filter((r) => r.status === filterSt);
    if (filterEq) result = result.filter((r) => r.equipment_id === filterEq);
    return [...result].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [rows, search, filterSt, filterEq, sortField, sortDir]);

  function toggleSort(field: keyof WorkRequest) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  const Th = ({ label, field }: { label: string; field?: keyof WorkRequest }) => (
    <th
      style={{ ...thStyle, cursor: field ? "pointer" : "default" }}
      onClick={() => field && toggleSort(field)}
    >
      {label}{field && sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>{l ? "Detalle Work Requests" : "Work Requests Detail"}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
          {filtered.length} / {rows.length}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "0.875rem", flexWrap: "wrap" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={l ? "Buscar..." : "Search..."}
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />
        <select value={filterSt} onChange={(e) => setFilterSt(e.target.value)} style={inputStyle}>
          <option value="">{l ? "Todos los status" : "All statuses"}</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterEq} onChange={(e) => setFilterEq(e.target.value)} style={inputStyle}>
          <option value="">{l ? "Todos los equipos" : "All equipment"}</option>
          {equipments.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        {(search || filterSt || filterEq) && (
          <button
            onClick={() => { setSearch(""); setFilterSt(""); setFilterEq(""); }}
            style={{ ...inputStyle, cursor: "pointer", color: "#ef4444", borderColor: "#ef4444" }}
          >
            ✕ {l ? "Limpiar" : "Clear"}
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", minWidth: 800 }}>
          <thead>
            <tr>
              <Th label="WR No"          field="work_request_no" />
              <Th label={l ? "Descripción" : "Description"} />
              <Th label={l ? "Asignado" : "Assigned To"}   field="assigned_to" />
              <Th label="Status"         field="status" />
              <Th label="Type"           field="type" />
              <Th label="Hours"          field="maintenance_hours" />
              <Th label="Equipment" />
              <Th label="Failure" />
              <Th label={l ? "Solicitado" : "Requested"}   field="request_date" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.work_request_no} style={{ background: i % 2 === 0 ? "transparent" : "var(--color-bg)" }}>
                <td style={tdStyle}>{r.work_request_no}</td>
                <td style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>
                  {r.description}
                </td>
                <td style={tdStyle}>{r.assigned_to === "Unassigned" ? (l ? "Sin asignar" : "Unassigned") : r.assigned_to}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: "0.15rem 0.5rem", borderRadius: 99,
                    background: `${sColor(r.status)}22`, color: sColor(r.status),
                    fontSize: "0.7rem", fontWeight: 700,
                  }}>
                    {r.status}
                  </span>
                </td>
                <td style={tdStyle}>{r.type}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  {r.maintenance_hours.toFixed(2)}
                </td>
                <td style={tdStyle}>{r.equipment_id || "—"}</td>
                <td style={{ ...tdStyle, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.failure}>
                  {r.failure || "—"}
                </td>
                <td style={tdStyle}>{r.request_date?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
            {l ? "Sin resultados" : "No results"}
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)", padding: "1.25rem",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0,
};
const thStyle: React.CSSProperties = {
  padding: "0.625rem 0.875rem", textAlign: "left", fontWeight: 600,
  color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap", background: "var(--color-bg)", position: "sticky", top: 0,
};
const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.875rem", color: "var(--color-text-primary)",
  borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
};
const inputStyle: React.CSSProperties = {
  padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)", background: "var(--color-surface)",
  color: "var(--color-text-primary)", fontSize: "0.8125rem",
};