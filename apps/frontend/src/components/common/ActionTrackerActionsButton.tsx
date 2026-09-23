import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, ListChecks, X } from "lucide-react";
import { ActionTrackerAction } from "./actionTracker.types";

interface Props {
  actions: ActionTrackerAction[];
  lang?: string;
}

export default function ActionTrackerActionsButton({ actions, lang = "es" }: Props) {
  const [open, setOpen] = useState(false);
  const spanish = lang.startsWith("es");

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={spanish ? "Ver acciones abiertas relacionadas" : "View related open actions"}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.7rem",
          border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
          background: "var(--color-surface)", color: "var(--color-text-primary)", cursor: "pointer",
          fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap",
        }}
      >
        <ListChecks size={16} />
        {spanish ? "Acciones" : "Actions"}
        {actions.length > 0 && (
          <span style={{
            minWidth: 20, height: 20, borderRadius: 10, display: "inline-grid", placeItems: "center",
            padding: "0 5px", background: "var(--color-primary)", color: "#fff", fontSize: "0.68rem",
          }}>
            {actions.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", padding: "1rem" }}
        >
          <div role="dialog" aria-modal="true" style={{
            width: "min(760px, 100%)", maxHeight: "80vh", overflow: "auto", background: "var(--color-surface)",
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", boxShadow: "0 18px 50px rgba(0,0,0,.28)",
          }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "1rem 1.1rem", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
              <div>
                <div style={{ fontWeight: 800, color: "var(--color-text-primary)" }}>{spanish ? "Acciones abiertas" : "Open actions"}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", marginTop: 2 }}>
                  {spanish ? "Incluye acciones del periodo y acciones históricas aún abiertas ligadas a los ofensores actuales." : "Includes period actions and older open actions linked to current offenders."}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: "none", color: "var(--color-text-primary)", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "0.8rem 1rem 1rem", display: "grid", gap: "0.65rem" }}>
              {actions.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.82rem" }}>
                  {spanish ? "No hay acciones abiertas relacionadas." : "No related open actions."}
                </div>
              ) : actions.map((action) => (
                <div key={action.item_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.8rem", display: "grid", gap: "0.35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <a href={action.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 800, color: "var(--color-primary)", textDecoration: "none" }}>
                      {action.code}<ExternalLink size={13} />
                    </a>
                    <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>{action.state} · {Number(action.progress || 0)}%</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 650, color: "var(--color-text-primary)" }}>{action.title}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>
                    {action.source === "scrap"
                      ? [action.business_unit, action.workcenter, action.reason].filter(Boolean).join(" · ")
                      : [action.equipment_id, action.equipment_description, action.physical_area].filter(Boolean).join(" · ")}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)" }}>
                    {spanish ? "Referencia semanal" : "Weekly reference"}: {action.first_week_start} → {action.last_week_end}
                    {action.due_date ? " · " + (spanish ? "Compromiso" : "Due") + ": " + action.due_date : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
