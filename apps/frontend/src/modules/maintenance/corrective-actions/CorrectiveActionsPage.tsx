import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CAService } from "./ca.service";
import {
  CorrectiveAction, CAFormData, EquipmentItem, AssigneeItem,
  Priority, CAStatus, CAMetrics, VALID_TRANSITIONS,
} from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#ef4444", medium: "#f59e0b", low: "#10b981",
};

const STATUS_COLOR: Record<CAStatus, string> = {
  open:               "#3b82f6",
  in_progress:        "#8b5cf6",
  pending_validation: "#f59e0b",
  on_hold:            "#6b7280",
  closed:             "#10b981",
  cancelled:          "#ef4444",
};

const STATUS_ORDER: CAStatus[] = [
  "open", "in_progress", "pending_validation", "on_hold", "closed", "cancelled",
];

function statusLabel(s: CAStatus, l: boolean): string {
  const map: Record<CAStatus, string> = {
    open:               "Open",
    in_progress:        l ? "En Progreso"          : "In Progress",
    pending_validation: l ? "Pendiente Validación" : "Pending Validation",
    on_hold:            l ? "En Espera"             : "On Hold",
    closed:             l ? "Cerrado"               : "Closed",
    cancelled:          l ? "Cancelado"             : "Cancelled",
  };
  return map[s];
}

function priorityLabel(p: Priority, l: boolean): string {
  return p === "high" ? (l ? "Alta" : "High") : p === "medium" ? (l ? "Media" : "Medium") : (l ? "Baja" : "Low");
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

// ── Badges ────────────────────────────────────────────────────────────────────

function PriorityBadge({ value, l }: { value: Priority; l: boolean }) {
  return (
    <span style={{
      fontSize: "0.68rem", fontWeight: 700, padding: "0.18rem 0.5rem",
      borderRadius: "999px", background: `${PRIORITY_COLOR[value]}18`,
      color: PRIORITY_COLOR[value], border: `1px solid ${PRIORITY_COLOR[value]}40`,
      whiteSpace: "nowrap",
    }}>
      {priorityLabel(value, l)}
    </span>
  );
}

function StatusBadge({ value, l }: { value: CAStatus; l: boolean }) {
  return (
    <span style={{
      fontSize: "0.68rem", fontWeight: 700, padding: "0.18rem 0.5rem",
      borderRadius: "999px", background: `${STATUS_COLOR[value]}18`,
      color: STATUS_COLOR[value], border: `1px solid ${STATUS_COLOR[value]}40`,
      whiteSpace: "nowrap",
    }}>
      {statusLabel(value, l)}
    </span>
  );
}

function DueBadge({ due, isOverdue }: { due: string | null; isOverdue: boolean }) {
  if (!due) return <span style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem" }}>—</span>;
  return (
    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: isOverdue ? "#ef4444" : "var(--color-text-secondary)" }}>
      {isOverdue ? "⚠ " : ""}{due}
    </span>
  );
}

// ── Métricas ──────────────────────────────────────────────────────────────────

function MetricsBar({ metrics, l }: { metrics: CAMetrics; l: boolean }) {
  const openCount = metrics.by_status.find((s) => s.status === "open")?.count ?? 0;
  const ipCount   = metrics.by_status.find((s) => s.status === "in_progress")?.count ?? 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem" }}>
      {[
        { label: "Total",                                         value: metrics.total,           color: "#3b82f6" },
        { label: "Open",                                          value: openCount,                color: "#3b82f6" },
        { label: l ? "En Progreso" : "In Progress",              value: ipCount,                  color: "#8b5cf6" },
        { label: l ? "Vencidas" : "Overdue",                     value: metrics.overdue,          color: "#ef4444" },
        { label: l ? "Cierre prom. (días)" : "Avg close (days)", value: metrics.avg_cycle_days ?? "—", color: "#10b981" },
      ].map((k) => (
        <div key={k.label} style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", padding: "0.875rem 1rem",
          borderLeft: `3px solid ${k.color}`,
        }}>
          <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>{k.label}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-text-primary)" }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Vista Kanban ──────────────────────────────────────────────────────────────

function KanbanView({ actions, l, onOpen }: {
  actions: CorrectiveAction[]; l: boolean; onOpen: (a: CorrectiveAction) => void;
}) {
  const COLUMNS: CAStatus[] = ["open", "in_progress", "pending_validation", "on_hold", "closed"];

  return (
    <div style={{ display: "flex", gap: "0.875rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
      {COLUMNS.map((col) => {
        const cards = actions.filter((a) => a.status === col);
        return (
          <div key={col} style={{
            minWidth: 240, flexShrink: 0,
            background: "var(--color-bg)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[col] }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {statusLabel(col, l)}
                </span>
              </div>
              <span style={{
                fontSize: "0.68rem", fontWeight: 700, padding: "0.1rem 0.4rem",
                borderRadius: "999px", background: `${STATUS_COLOR[col]}20`, color: STATUS_COLOR[col],
              }}>
                {cards.length}
              </span>
            </div>
            <div style={{ padding: "0.625rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
              {cards.length === 0 ? (
                <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", textAlign: "center", padding: "1rem 0" }}>
                  {l ? "Sin acciones" : "No actions"}
                </div>
              ) : cards.map((a) => (
                <div key={a.id} onClick={() => onOpen(a)}
                  style={{
                    background: "var(--color-surface)",
                    border: `1px solid ${a.is_overdue ? "#ef444440" : "var(--color-border)"}`,
                    borderLeft: `3px solid ${PRIORITY_COLOR[a.priority]}`,
                    borderRadius: "var(--radius-md)", padding: "0.75rem",
                    cursor: "pointer", transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.375rem", lineHeight: 1.3 }}>
                    {a.title}
                  </div>
                  {a.equipment_id && (
                    <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", marginBottom: "0.375rem" }}>
                      🔧 {a.equipment_id}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                    <PriorityBadge value={a.priority} l={l} />
                    <DueBadge due={a.due_date} isOverdue={a.is_overdue} />
                  </div>
                  {a.assigned_to_name && a.assigned_to_name !== "—" && (
                    <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)", marginTop: "0.375rem" }}>
                      👤 {a.assigned_to_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Vista Tabla ───────────────────────────────────────────────────────────────

function TableView({ actions, l, onOpen, onDelete }: {
  actions: CorrectiveAction[]; l: boolean;
  onOpen: (a: CorrectiveAction) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr style={{ background: "var(--color-bg)" }}>
            {["#", l ? "Título" : "Title", l ? "Equipo" : "Equipment",
              l ? "Prioridad" : "Priority", "Status",
              l ? "Responsable" : "Assignee", "Due Date", ""].map((h) => (
              <th key={h} style={{
                padding: "0.625rem 0.75rem", textAlign: "left",
                fontSize: "0.68rem", fontWeight: 700, color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {actions.map((a, i) => (
            <tr key={a.id}
              style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer" }}
              onClick={() => onOpen(a)}
            >
              <td style={{ padding: "0.625rem 0.75rem", color: "var(--color-text-secondary)" }}>{i + 1}</td>
              <td style={{ padding: "0.625rem 0.75rem" }}>
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.title}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)" }}>{a.created_by_name}</div>
              </td>
              <td style={{ padding: "0.625rem 0.75rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-primary)" }}>{a.equipment_id || "—"}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)" }}>{a.equipment_desc}</div>
              </td>
              <td style={{ padding: "0.625rem 0.75rem" }}><PriorityBadge value={a.priority} l={l} /></td>
              <td style={{ padding: "0.625rem 0.75rem" }}><StatusBadge value={a.status} l={l} /></td>
              <td style={{ padding: "0.625rem 0.75rem", color: "var(--color-text-secondary)", fontSize: "0.75rem" }}>{a.assigned_to_name || "—"}</td>
              <td style={{ padding: "0.625rem 0.75rem" }}><DueBadge due={a.due_date} isOverdue={a.is_overdue} /></td>
              <td style={{ padding: "0.625rem 0.75rem" }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onDelete(a.id)} style={{
                  padding: "0.2rem 0.5rem", fontSize: "0.68rem", fontWeight: 600,
                  border: "1px solid #ef444440", borderRadius: "var(--radius-sm)",
                  background: "#ef444410", color: "#ef4444", cursor: "pointer",
                }}>
                  {l ? "Eliminar" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Modal Crear ───────────────────────────────────────────────────────────────

const EMPTY_FORM: CAFormData = {
  title: "", description: "", priority: "medium", status: "open",
  equipment_id: "", equipment_desc: "", equipment_group: "",
  root_cause: "", failure_type: "", corrective_action: "",
  assigned_to: null, due_date: null, close_notes: "",
};

function CreateModal({ equipment, lang, onClose, onSaved }: {
  equipment: EquipmentItem[]; lang: string; onClose: () => void; onSaved: () => void;
}) {
  const l = lang === "es";
  const [form,   setForm]   = useState<CAFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const set = (k: keyof CAFormData, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleEquipment = (id: string) => {
    const eq = equipment.find((e) => e.Equipment_ID === id);
    if (eq) { set("equipment_id", eq.Equipment_ID); set("equipment_desc", eq.Description); set("equipment_group", eq.Equipment_Group); }
    else     { set("equipment_id", ""); set("equipment_desc", ""); set("equipment_group", ""); }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError(l ? "El título es requerido." : "Title is required."); return; }
    setSaving(true); setError(null);
    try {
      await CAService.create({
        title: form.title, description: form.description, priority: form.priority,
        equipment_id: form.equipment_id, equipment_desc: form.equipment_desc, equipment_group: form.equipment_group,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail || (l ? "Error guardando." : "Error saving."));
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.8125rem",
    borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
    background: "var(--color-bg)", color: "var(--color-text-primary)", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.25rem", display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem", width: "min(520px, 95vw)", display: "flex", flexDirection: "column", gap: "1rem" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
          {l ? "Registrar Acción Correctiva" : "Register Corrective Action"}
        </div>
        {error && <div style={{ fontSize: "0.8rem", color: "#ef4444", background: "#ef444410", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)" }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={lbl}>{l ? "Título *" : "Title *"}</label>
          <input style={inp} value={form.title} onChange={(e) => set("title", e.target.value)}
            placeholder={l ? "Describe la falla brevemente" : "Brief description of the failure"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={lbl}>{l ? "Equipo" : "Equipment"}</label>
            <select style={inp} value={form.equipment_id} onChange={(e) => handleEquipment(e.target.value)}>
              <option value="">{l ? "— Seleccionar —" : "— Select —"}</option>
              {equipment.map((eq) => (
                <option key={eq.Equipment_Key} value={eq.Equipment_ID}>{eq.Equipment_ID} — {eq.Description}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={lbl}>{l ? "Prioridad" : "Priority"}</label>
            <select style={inp} value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              <option value="high">{l ? "Alta" : "High"}</option>
              <option value="medium">{l ? "Media" : "Medium"}</option>
              <option value="low">{l ? "Baja" : "Low"}</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={lbl}>{l ? "Descripción" : "Description"}</label>
          <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }}
            value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--color-border)" }}>
          <button onClick={onClose} style={{ padding: "0.5rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", cursor: "pointer", fontSize: "0.8125rem" }}>
            {l ? "Cancelar" : "Cancel"}
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: "0.5rem 1.25rem", borderRadius: "var(--radius-sm)", border: "none", background: "#3b82f6", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.8125rem", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? (l ? "Guardando..." : "Saving...") : (l ? "Registrar" : "Register")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Detalle ─────────────────────────────────────────────────────────────

function DetailModal({ action: initialAction, assignees, lang, onClose, onUpdated }: {
  action:    CorrectiveAction;
  assignees: AssigneeItem[];
  lang:      string;
  onClose:   () => void;
  onUpdated: () => void;
}) {
  const l = lang === "es";

  const [action,      setAction]      = useState<CorrectiveAction>({
    ...initialAction,
    comments: initialAction.comments ?? [],
    history:  initialAction.history  ?? [],
  });
  const [saving,      setSaving]      = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting,     setPosting]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTab,   setActiveTab]   = useState<"detail" | "history">("detail");

  // Carga el detalle completo (con comments e history) en background
  useEffect(() => {
    CAService.get(initialAction.id).then((full) => {
      setAction({
        ...full,
        comments: full.comments ?? [],
        history:  full.history  ?? [],
      });
    }).catch(() => {});
  }, [initialAction.id]);

  const reload = async () => {
    const fresh = await CAService.get(action.id);
    setAction({
      ...fresh,
      comments: fresh.comments ?? [],
      history:  fresh.history  ?? [],
    });
  };

  const handleField = async (field: keyof CAFormData, value: any) => {
    setSaving(true); setError(null);
    try {
      const updated = await CAService.update(action.id, { [field]: value });
      setAction({ ...updated, comments: updated.comments ?? action.comments, history: updated.history ?? action.history });
      onUpdated();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.[0] || (l ? "Error guardando." : "Error saving."));
    } finally { setSaving(false); }
  };

  const handleTransition = async (newStatus: CAStatus) => {
    if (newStatus === "closed") {
      if (!action.close_notes.trim() && (action.comments ?? []).length === 0) {
        setError(l ? "Agrega notas de cierre o un comentario antes de cerrar." : "Add close notes or a comment before closing.");
        return;
      }
    }
    setSaving(true); setError(null);
    try {
      const updated = await CAService.transition(action.id, newStatus);
      setAction({ ...updated, comments: updated.comments ?? action.comments, history: updated.history ?? action.history });
      onUpdated();
      await reload();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.[0] || (l ? "Error." : "Error."));
    } finally { setSaving(false); }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await CAService.addComment(action.id, commentText);
      setCommentText("");
      await reload();
    } finally { setPosting(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.4rem 0.6rem", fontSize: "0.8rem",
    borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
    background: "var(--color-bg)", color: "var(--color-text-primary)", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: "0.68rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.2rem", display: "block" };
  const sectionTitle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" };

  const transitions = VALID_TRANSITIONS[action.status];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem", width: "min(760px, 96vw)", maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>{action.title}</div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge value={action.status} l={l} />
              <PriorityBadge value={action.priority} l={l} />
              {action.is_overdue && <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 700 }}>⚠ {l ? "Vencida" : "Overdue"}</span>}
              {action.cycle_time_days != null && <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)" }}>⏱ {action.cycle_time_days}d</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--color-text-secondary)", flexShrink: 0 }}>✕</button>
        </div>

        {error && (
          <div style={{ fontSize: "0.8rem", color: "#ef4444", background: "#ef444410", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)" }}>{error}</div>
        )}

        {/* Transiciones */}
        {transitions.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", alignSelf: "center" }}>
              {l ? "Mover a:" : "Move to:"}
            </span>
            {transitions.map((t) => (
              <button key={t} onClick={() => handleTransition(t)} disabled={saving} style={{
                padding: "0.3rem 0.875rem", fontSize: "0.72rem", fontWeight: 700,
                border: `1px solid ${STATUS_COLOR[t]}60`, borderRadius: "var(--radius-sm)",
                background: `${STATUS_COLOR[t]}15`, color: STATUS_COLOR[t],
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              }}>
                {statusLabel(t, l)}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
          {(["detail", "history"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600,
              border: "none", borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
              background: "none", color: activeTab === tab ? "#3b82f6" : "var(--color-text-secondary)",
              cursor: "pointer", marginBottom: "-1px",
            }}>
              {tab === "detail" ? (l ? "Detalle" : "Detail") : (l ? "Historial" : "History")}
            </button>
          ))}
        </div>

        {activeTab === "detail" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Análisis */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={sectionTitle}>{l ? "Análisis" : "Analysis"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={lbl}>{l ? "Causa Raíz" : "Root Cause"}</label>
                  <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }}
                    defaultValue={action.root_cause}
                    onBlur={(e) => { if (e.target.value !== action.root_cause) handleField("root_cause", e.target.value); }}
                  />
                </div>
                <div>
                  <label style={lbl}>{l ? "Tipo de Falla" : "Failure Type"}</label>
                  <input style={inp} defaultValue={action.failure_type}
                    onBlur={(e) => { if (e.target.value !== action.failure_type) handleField("failure_type", e.target.value); }}
                  />
                </div>
              </div>
            </div>

            {/* Ejecución */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={sectionTitle}>{l ? "Ejecución" : "Execution"}</div>
              <div>
                <label style={lbl}>{l ? "Acción Correctiva" : "Corrective Action"}</label>
                <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }}
                  defaultValue={action.corrective_action}
                  onBlur={(e) => { if (e.target.value !== action.corrective_action) handleField("corrective_action", e.target.value); }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={lbl}>{l ? "Responsable" : "Assignee"}</label>
                  <select style={inp} value={action.assigned_to ?? ""}
                    onChange={(e) => handleField("assigned_to", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">{l ? "— Sin asignar —" : "— Unassigned —"}</option>
                    {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Due Date</label>
                  <input type="date" style={inp} value={action.due_date ?? ""}
                    onChange={(e) => handleField("due_date", e.target.value || null)} />
                </div>
              </div>
            </div>

            {/* Cierre — solo en pending_validation */}
            {action.status === "pending_validation" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={sectionTitle}>{l ? "Cierre" : "Closure"}</div>
                <div>
                  <label style={lbl}>{l ? "Notas de Cierre *" : "Close Notes *"}</label>
                  <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }}
                    defaultValue={action.close_notes}
                    onBlur={(e) => { if (e.target.value !== action.close_notes) handleField("close_notes", e.target.value); }}
                    placeholder={l ? "Describe la validación realizada..." : "Describe the validation performed..."}
                  />
                </div>
              </div>
            )}

            {/* Comentarios / Bitácora */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={sectionTitle}>{l ? "Bitácora / Comentarios" : "Comments / Log"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 220, overflowY: "auto" }}>
                {(action.comments ?? []).length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                    {l ? "Sin comentarios aún." : "No comments yet."}
                  </div>
                ) : (action.comments ?? []).map((c) => (
                  <div key={c.id} style={{ background: "var(--color-bg)", borderRadius: "var(--radius-sm)", padding: "0.625rem 0.75rem", border: "1px solid var(--color-border)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-primary)", marginBottom: "0.25rem" }}>{c.text}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)" }}>
                      {c.created_by_name} · {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input style={{ ...inp, flex: 1 }} value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleComment(); }}
                  placeholder={l ? "Agregar comentario..." : "Add comment..."}
                />
                <button onClick={handleComment} disabled={posting || !commentText.trim()} style={{
                  padding: "0.4rem 0.875rem", borderRadius: "var(--radius-sm)",
                  border: "none", background: "#3b82f6", color: "#fff",
                  cursor: posting || !commentText.trim() ? "not-allowed" : "pointer",
                  fontSize: "0.8rem", fontWeight: 600, opacity: posting ? 0.6 : 1, flexShrink: 0,
                }}>
                  {posting ? "..." : (l ? "Enviar" : "Send")}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {(action.history ?? []).length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                {l ? "Sin historial." : "No history."}
              </div>
            ) : (action.history ?? []).map((h) => (
              <div key={h.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-primary)" }}>
                    <strong>{h.field}</strong>: {h.old_value || "—"} → {h.new_value || "—"}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)" }}>
                    {h.changed_by_name} · {new Date(h.changed_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type ViewMode = "kanban" | "table";

export default function CorrectiveActionsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const l    = lang === "es";

  const [actions,      setActions]      = useState<CorrectiveAction[]>([]);
  const [equipment,    setEquipment]    = useState<EquipmentItem[]>([]);
  const [assignees,    setAssignees]    = useState<AssigneeItem[]>([]);
  const [metrics,      setMetrics]      = useState<CAMetrics | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [viewMode,     setViewMode]     = useState<ViewMode>("kanban");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [createOpen,   setCreateOpen]   = useState(false);
  const [detailAction, setDetailAction] = useState<CorrectiveAction | null>(null);
  const [deleteId,     setDeleteId]     = useState<number | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const loadCatalogs = useCallback(async () => {
    const [eq, as] = await Promise.all([
      CAService.getEquipment().catch(() => []),
      CAService.getAssignees().catch(() => []),
    ]);
    setEquipment(eq);
    setAssignees(as);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterStatus)   filters.status   = filterStatus;
      if (filterPriority) filters.priority = filterPriority;
      const [acts, mets] = await Promise.all([
        CAService.list(filters),
        CAService.getMetrics(),
      ]);
      setActions(acts);
      setMetrics(mets);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority]);

  useEffect(() => { loadCatalogs(); }, [loadCatalogs]);
  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (deleteId == null) return;
    setDeleting(true);
    try {
      await CAService.delete(deleteId);
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setDeleting(false); }
  };

  const sel: React.CSSProperties = {
    padding: "0.35rem 0.625rem", fontSize: "0.78rem",
    borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
    background: "var(--color-surface)", color: "var(--color-text-primary)", cursor: "pointer",
  };
  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: "0.35rem 0.875rem", fontSize: "0.78rem", fontWeight: 600,
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
    background: active ? "#3b82f6" : "var(--color-surface)",
    color: active ? "#fff" : "var(--color-text-secondary)", cursor: "pointer",
  });

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            {l ? "Acciones Correctivas" : "Corrective Actions"}
          </h1>
         
        </div>
        <button onClick={() => setCreateOpen(true)} style={{
          padding: "0.5rem 1.25rem", borderRadius: "var(--radius-md)",
          border: "none", background: "#3b82f6", color: "#fff",
          cursor: "pointer", fontSize: "0.875rem", fontWeight: 600,
        }}>
          + {l ? "Nueva Acción" : "New Action"}
        </button>
      </div>

      {/* Métricas */}
      {metrics && <MetricsBar metrics={metrics} l={l} />}

      {/* Controles */}
      <div style={{ display: "flex", gap: "0.625rem", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select style={sel} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{statusLabel(s, l)}</option>)}
          </select>
          <select style={sel} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">{l ? "Todas las prioridades" : "All Priorities"}</option>
            <option value="high">{l ? "Alta" : "High"}</option>
            <option value="medium">{l ? "Media" : "Medium"}</option>
            <option value="low">{l ? "Baja" : "Low"}</option>
          </select>
          {(filterStatus || filterPriority) && (
            <button onClick={() => { setFilterStatus(""); setFilterPriority(""); }}
              style={{ ...sel, color: "#ef4444", borderColor: "#ef444440" }}>
              ✕ {l ? "Limpiar" : "Clear"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button style={toggleBtn(viewMode === "kanban")} onClick={() => setViewMode("kanban")}>⊞ Kanban</button>
          <button style={toggleBtn(viewMode === "table")}  onClick={() => setViewMode("table")}>☰ {l ? "Tabla" : "Table"}</button>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>
          {l ? "Cargando..." : "Loading..."}
        </div>
      ) : actions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          {l ? "No hay acciones correctivas registradas." : "No corrective actions found."}
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanView actions={actions} l={l} onOpen={setDetailAction} />
      ) : (
        <TableView actions={actions} l={l} onOpen={setDetailAction} onDelete={setDeleteId} />
      )}

      {/* Modal crear */}
      {createOpen && (
        <CreateModal
          equipment={equipment} lang={lang}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); loadData(); }}
        />
      )}

      {/* Modal detalle */}
      {detailAction && (
        <DetailModal
          action={detailAction} assignees={assignees} lang={lang}
          onClose={() => setDetailAction(null)}
          onUpdated={loadData}
        />
      )}

      {/* Confirm delete */}
      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDeleteId(null)}>
          <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem", width: 360 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: "0.75rem", color: "var(--color-text-primary)" }}>
              {l ? "¿Eliminar esta acción?" : "Delete this action?"}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
              {l ? "Solo se pueden eliminar acciones en estado Open o Cancelled." : "Only Open or Cancelled actions can be deleted."}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "0.5rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: "pointer", fontSize: "0.8125rem" }}>
                {l ? "Cancelar" : "Cancel"}
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: "0.5rem 1rem", borderRadius: "var(--radius-sm)", border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>
                {deleting ? "..." : (l ? "Sí, eliminar" : "Yes, delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}