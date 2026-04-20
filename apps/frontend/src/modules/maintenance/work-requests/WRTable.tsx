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

function StatusChip({ status }: { status: string }) {
  const col = sColor(status);
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: col, background: `${col}18`, border: `1px solid ${col}40`, borderRadius: 4, padding: "0.15rem 0.45rem", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

// ─── Mini gráfica de status dentro del desplegable ───────────────────────────
function TypeStatusChart({ typeRows, lang }: { typeRows: WorkRequest[]; lang: string }) {
  const l = lang === "es";

  // Agrupar por status
  const statusMap = new Map<string, { count: number; hours: number }>();
  typeRows.forEach((r) => {
    const s = r.status;
    if (!statusMap.has(s)) statusMap.set(s, { count: 0, hours: 0 });
    const acc = statusMap.get(s)!;
    acc.count++;
    acc.hours += r.maintenance_hours;
  });

  const items   = [...statusMap.entries()].sort((a, b) => b[1].hours - a[1].hours);
  const total   = typeRows.length;
  const maxH    = Math.max(...items.map(([, v]) => v.hours), 1);
  const totalH  = items.reduce((s, [, v]) => s + v.hours, 0);

  // Mini donut SVG
  const size = 72; const cx = size / 2; const cy = size / 2; const r = 28; const stroke = 10;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = items.map(([status, val]) => {
    const pct  = val.count / total;
    const dash = circumference * pct;
    const arc  = { status, pct, dash, offset, col: sColor(status) };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", padding: "0.75rem 1rem", background: "var(--color-bg)", borderTop: "1px solid var(--color-border)" }}>
      
      {/* Donut */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.status}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.col}
              strokeWidth={stroke}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.offset + circumference * 0.25}
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          ))}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={13} fontWeight="700" fill="var(--color-text-primary)">{total}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" fontSize={7} fill="var(--color-text-secondary)">WR</text>
        </svg>
        <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textAlign: "center" }}>
          {totalH.toFixed(1)} h {l ? "total" : "total"}
        </div>
      </div>

      {/* Leyenda + barras */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem", justifyContent: "center" }}>
        {items.map(([status, val]) => {
          const col    = sColor(status);
          const barPct = (val.hours / maxH) * 100;
          return (
            <div key={status} style={{ display: "grid", gridTemplateColumns: "120px 1fr 48px 52px", gap: "0.5rem", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status}</span>
              </div>
              <div style={{ position: "relative", height: 14, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: `${barPct}%`, height: "100%", background: col, opacity: 0.75, borderRadius: 3, transition: "width 0.3s ease" }} />
              </div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: col, textAlign: "right" }}>
                {val.count} <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>({Math.round(val.count / total * 100)}%)</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#3b82f6", textAlign: "right", fontWeight: 600 }}>
                {val.hours.toFixed(1)} h
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const card: React.CSSProperties         = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" };
const inputStyle: React.CSSProperties   = { padding: "0.35rem 0.6rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.8125rem" };
const thStyle: React.CSSProperties      = { padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)", borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties      = { padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-primary)", verticalAlign: "middle" };

export default function WRTable({ rows, lang }: Props) {
  const l = lang === "es";
  const [search,    setSearch]    = useState("");
  const [filterSt,  setFilterSt]  = useState("");
  const [filterEq,  setFilterEq]  = useState("");
  const [sortField, setSortField] = useState<keyof WorkRequest>("request_date");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});

  const statuses = [...new Set(rows.map((r) => r.status))].sort();

  const equipmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.equipment_id) map.set(r.equipment_id, r.equipment_description || r.equipment_id); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (search)   result = result.filter((r) =>
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.work_request_no.toString().includes(search) ||
      r.assigned_to.toLowerCase().includes(search.toLowerCase()) ||
      r.equipment_description.toLowerCase().includes(search.toLowerCase())
    );
    if (filterSt) result = result.filter((r) => r.status === filterSt);
    if (filterEq) result = result.filter((r) => r.equipment_id === filterEq);
    return [...result].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [rows, search, filterSt, filterEq, sortField, sortDir]);

  const byType = useMemo(() => {
    const map = new Map<string, WorkRequest[]>();
    filtered.forEach((r) => {
      const t = r.type || "Unknown";
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(r);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  function toggleSort(field: keyof WorkRequest) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  function toggleType(type: string) {
    setOpenTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  const isOpen = (type: string) => openTypes[type] ?? false;

  const Th = ({ label, field }: { label: string; field?: keyof WorkRequest }) => (
    <th style={{ ...thStyle, cursor: field ? "pointer" : "default" }} onClick={() => field && toggleSort(field)}>
      {label}{field && sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>{l ? "Detalle Work Requests" : "Work Requests Detail"}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>{filtered.length} / {rows.length}</div>
      </div>

      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "0.875rem", flexWrap: "wrap" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={l ? "Buscar WR, descripción, técnico, equipo..." : "Search WR, description, technician, equipment..."}
          style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        <select value={filterSt} onChange={(e) => setFilterSt(e.target.value)} style={inputStyle}>
          <option value="">{l ? "Todos los status" : "All statuses"}</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterEq} onChange={(e) => setFilterEq(e.target.value)} style={{ ...inputStyle, maxWidth: 260 }}>
          <option value="">{l ? "Todos los equipos" : "All equipment"}</option>
          {equipmentOptions.map(([id, desc]) => <option key={id} value={id}>{desc}</option>)}
        </select>
        {(search || filterSt || filterEq) && (
          <button onClick={() => { setSearch(""); setFilterSt(""); setFilterEq(""); }}
            style={{ ...inputStyle, cursor: "pointer", color: "#ef4444", borderColor: "#ef4444" }}>
            ✕ {l ? "Limpiar" : "Clear"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {byType.map(([type, typeRows]) => (
          <div key={type} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {/* Header del grupo */}
            <div onClick={() => toggleType(type)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 1rem", cursor: "pointer", background: isOpen(type) ? "var(--color-border)" : "transparent", userSelect: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {isOpen(type) ? "▼" : "▶"} {type}
                </span>
                <span style={{ fontSize: "0.72rem", background: "var(--color-border)", borderRadius: 10, padding: "0.1rem 0.5rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                  {typeRows.length} WR
                </span>
                <span style={{ fontSize: "0.72rem", color: "#3b82f6", fontWeight: 600 }}>
                  {typeRows.reduce((s, r) => s + r.maintenance_hours, 0).toFixed(1)} h
                </span>
              </div>
              
            </div>

            {isOpen(type) && (
              <>
                

                {/* ── Tabla de filas ── */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 780 }}>
                    <thead>
                      <tr style={{ background: "var(--color-bg)" }}>
                        <Th label="WR No"                              field="work_request_no" />
                        <Th label={l ? "Descripción" : "Description"} />
                        <Th label={l ? "Equipo" : "Equipment"} />
                        <Th label={l ? "Asignado" : "Assigned To"}    field="assigned_to" />
                        <Th label="Status"                             field="status" />
                        <Th label="Hours"                              field="maintenance_hours" />
                        <Th label="Failure" />
                        <Th label={l ? "Solicitado" : "Requested"}    field="request_date" />
                        <Th label={l ? "Vence" : "Due"}               field="due_date" />
                      </tr>
                    </thead>
                    <tbody>
                      {typeRows.map((r, i) => {
                        const isOverdue = !r.completed_date && r.due_date && new Date(r.due_date) < new Date();
                        return (
                          <tr key={r.work_request_no} style={{ background: i % 2 === 0 ? "transparent" : "var(--color-bg)" }}>
                            <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {r.work_request_no}
                            </td>
                            <td style={{ ...tdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>
                              {r.description}
                            </td>
                            <td style={{ ...tdStyle, maxWidth: 180 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.775rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${r.equipment_id} — ${r.equipment_description}`}>
                                {r.equipment_description || r.equipment_id || "—"}
                              </div>
                              {r.equipment_description && r.equipment_id && (
                                <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)" }}>{r.equipment_id}</div>
                              )}
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                              {r.assigned_to === "Unassigned" ? <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>—</span> : r.assigned_to}
                            </td>
                            <td style={tdStyle}><StatusChip status={r.status} /></td>
                            <td style={{ ...tdStyle, fontWeight: 700, color: "#3b82f6", textAlign: "right", whiteSpace: "nowrap" }}>
                              {r.maintenance_hours.toFixed(1)} h
                            </td>
                            <td style={{ ...tdStyle, fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                              {r.failure || r.failure_type || "—"}
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.775rem" }}>{r.request_date?.slice(0, 10)}</td>
                            <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.775rem", color: isOverdue ? "#ef4444" : "var(--color-text-primary)", fontWeight: isOverdue ? 700 : 400 }}>
                              {r.due_date?.slice(0, 10) || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}