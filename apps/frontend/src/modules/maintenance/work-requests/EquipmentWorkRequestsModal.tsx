import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { GroupedItem, WorkRequest } from "./types";

interface Props {
  equipment: GroupedItem;
  rows: WorkRequest[];
  lang: string;
  onClose: () => void;
}

const names: Record<string, [string, string]> = {
  work_request_no: ["No. Work Request", "Work Request No."],
  description: ["Descripción / solicitud", "Description / request"],
  request_date: ["Fecha de solicitud", "Request date"],
  due_date: ["Fecha compromiso", "Due date"],
  completed_date: ["Fecha de cierre", "Completed date"],
  status: ["Estado", "Status"],
  type: ["Tipo de mantenimiento", "Maintenance type"],
  assigned_to: ["Asignado a", "Assigned to"],
  equipment_id: ["ID de equipo", "Equipment ID"],
  equipment_description: ["Descripción del equipo", "Equipment description"],
  equipment_group: ["Grupo de equipos", "Equipment group"],
  workcenter: ["Workcenter", "Workcenter"],
  workcenter_group: ["Grupo de Workcenter", "Workcenter group"],
  department: ["Departamento", "Department"],
  scheduled_hours: ["Horas programadas", "Scheduled hours"],
  maintenance_hours: ["Horas reales", "Actual hours"],
  failure: ["Falla", "Failure"],
  failure_type: ["Tipo de falla", "Failure type"],
  failure_action: ["Acción correctiva", "Failure action"],
};

const fmt = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
};

const cell: React.CSSProperties = {
  padding: "0.7rem 0.65rem", borderBottom: "1px solid var(--color-border)",
  color: "var(--color-text-primary)", verticalAlign: "top", fontSize: "0.8rem",
};
const head: React.CSSProperties = {
  ...cell, color: "var(--color-text-secondary)", fontSize: "0.72rem",
  fontWeight: 700, background: "var(--color-bg)", whiteSpace: "nowrap",
};
const secondary: React.CSSProperties = { color: "var(--color-text-secondary)", fontSize: "0.75rem" };

export default function EquipmentWorkRequestsModal({ equipment, rows, lang, onClose }: Props) {
  const es = lang === "es";
  const closeRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  // The backend provides the exact WR identifiers used by the aggregator.
  // Do not reimplement the Pareto classification or sum different source data.
  const contributing = useMemo(() => {
    const ids = new Set((equipment.work_request_nos ?? []).map(String));
    return rows
      .filter((row) => ids.has(String(row.work_request_no)))
      .sort((a, b) => b.maintenance_hours - a.maintenance_hours);
  }, [equipment.work_request_nos, rows]);
  const hours = contributing.reduce((total, row) => total + Number(row.maintenance_hours || 0), 0);
  const scheduled = contributing.reduce((total, row) => total + Number(row.scheduled_hours || 0), 0);
  const reconciled = contributing.length === equipment.count && Math.abs(hours - equipment.hours) < 0.005;
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    contributing.forEach((row) => counts.set(row.status || "—", (counts.get(row.status || "—") ?? 0) + 1));
    return [...counts.entries()];
  }, [contributing]);
  const filtered = contributing.filter((row) =>
    [row.work_request_no, row.description, row.status, row.failure, row.assigned_to]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  );
  const label = equipment.equipment_description || equipment.label;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("maintenance-pareto-wr-dialog");
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const toggle = (no: string) => {
    setExpanded((current) => current.includes(no) ? current.filter((value) => value !== no) : [...current, no]);
  };

  return createPortal(
    <div
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.68)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <section
        id="maintenance-pareto-wr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-pareto-wr-title"
        style={{ width: "min(1120px, 100%)", maxHeight: "min(92vh, 1000px)", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", boxShadow: "0 24px 65px rgba(0,0,0,.3)" }}
      >
        <header style={{ padding: "1.1rem 1.4rem", display: "flex", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <h2 id="maintenance-pareto-wr-title" style={{ margin: 0, fontSize: "1.125rem", color: "var(--color-text-primary)" }}>
              {es ? "Work Requests del equipo" : "Equipment Work Requests"} — {equipment.label}
            </h2>
            <div style={{ ...secondary, marginTop: 5 }}>{label} · {es ? "Origen: Plex Work Requests / Unplanned Maintenance" : "Source: Plex Work Requests / Unplanned Maintenance"}</div>
            {equipment.physical_area && <div style={secondary}>{es ? "Workcenter: " : "Workcenter: "}{equipment.physical_area}</div>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={es ? "Cerrar" : "Close"} style={{ alignSelf: "flex-start", padding: "0.35rem", display: "grid", placeItems: "center", background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "var(--radius-md)", cursor: "pointer" }}><X size={20} /></button>
        </header>
        <div style={{ overflowY: "auto", padding: "1.25rem 1.4rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            {[
              { value: equipment.hours.toFixed(2) + " h", label: es ? "Horas acumuladas en Pareto" : "Hours in Pareto" },
              { value: String(equipment.count), label: "Work Requests" },
              { value: scheduled.toFixed(2) + " h", label: es ? "Horas programadas de esos WR" : "Scheduled WR hours" },
              { value: (contributing.length ? hours / contributing.length : 0).toFixed(2) + " h", label: es ? "Promedio real por WR" : "Avg actual per WR" },
            ].map((item) => (
              <div key={item.label} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.85rem", background: "var(--color-bg)" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 750, color: "var(--color-text-primary)" }}>{item.value}</div>
                <div style={secondary}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ ...secondary, marginBottom: "0.8rem" }}>
            {es ? "Estados: " : "Statuses: "}{statusCounts.map(([status, count]) => status + " (" + count + ")").join(" · ") || "—"}
          </div>
          {!reconciled && (
            <div role="alert" style={{ padding: "0.7rem", border: "1px solid #ef4444", borderRadius: 6, color: "#ef4444", marginBottom: "1rem" }}>
              {es ? "El detalle no coincide con el total del Pareto. Actualiza el dashboard antes de usar estos datos." : "The WR detail does not reconcile with the Pareto. Refresh the dashboard before relying on it."}
              {" "}{hours.toFixed(2)} h / {contributing.length} WR.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.7rem", marginBottom: "0.7rem" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              {es ? "Detalle de WR que aportan horas" : "Contributing Work Request details"}
              <span style={{ ...secondary, marginLeft: 8 }}>{filtered.length} / {contributing.length}</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.35rem 0.6rem", color: "var(--color-text-secondary)" }}>
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={es ? "Buscar WR, falla, técnico..." : "Search WR, failure, technician..."} aria-label={es ? "Buscar Work Requests" : "Search Work Requests"} style={{ border: 0, outline: 0, background: "transparent", color: "var(--color-text-primary)", fontSize: "0.8rem", width: 215 }} />
            </label>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 825 }}>
              <thead><tr>
                {[es ? "No. WR" : "WR No.", es ? "Solicitud" : "Requested", es ? "Estado" : "Status", es ? "Falla" : "Failure", es ? "Asignado" : "Assigned", es ? "Hrs reales" : "Actual h", es ? "Hrs prog." : "Scheduled h", es ? "Detalle" : "Details"].map((heading) => <th key={heading} style={head}>{heading}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((row) => {
                  const no = String(row.work_request_no);
                  const isExpanded = expanded.includes(no);
                  return (
                    <tr key={no} style={{ background: isExpanded ? "var(--color-bg)" : "transparent" }}>
                      <td style={{ ...cell, fontWeight: 700 }}>{no}</td>
                      <td style={cell}>{fmt(row.request_date)}</td>
                      <td style={cell}>{fmt(row.status)}</td>
                      <td style={cell}>{fmt(row.failure)}</td>
                      <td style={cell}>{fmt(row.assigned_to)}</td>
                      <td style={{ ...cell, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{Number(row.maintenance_hours).toFixed(2)}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{Number(row.scheduled_hours || 0).toFixed(2)}</td>
                      <td style={cell}>
                        <button type="button" aria-expanded={isExpanded} onClick={() => toggle(no)} style={{ display: "flex", gap: 4, alignItems: "center", color: "var(--color-primary)", background: "transparent", border: 0, cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                          {es ? "Ver" : "View"} {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                        {isExpanded && (
                          <div style={{ marginTop: "0.65rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.6rem", minWidth: 330 }}>
                            <div style={{ ...secondary, marginBottom: "0.35rem", fontWeight: 700 }}>{es ? "Todos los campos recibidos desde Plex" : "All fields received from Plex"}</div>
                            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(110px, 0.7fr) minmax(160px, 1fr)", columnGap: "0.7rem", rowGap: "0.35rem" }}>
                              {Object.entries(row).map(([key, value]) => (
                                <div key={key} style={{ display: "contents" }}>
                                  <dt style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem", overflowWrap: "anywhere" }}>{names[key]?.[es ? 0 : 1] ?? key}</dt>
                                  <dd style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "0.75rem", overflowWrap: "anywhere" }}>{fmt(value)}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={8} style={{ ...cell, textAlign: "center" }}>{es ? "No se encontraron Work Requests" : "No Work Requests found"}</td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ ...secondary, margin: "0.85rem 0 0" }}>
            {es ? "Las horas se suman una sola vez por WR, usando maintenance_hours; no representan los tiempos Down/Setup/Idle de producción. Expande «Ver» para consultar todos los campos del registro." : "Hours are counted once per WR using maintenance_hours, not production Down/Setup/Idle. Expand View to inspect every original field."}
          </p>
        </div>
      </section>
    </div>,
    document.body
  );
}
