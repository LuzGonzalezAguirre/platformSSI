import { useState } from "react";
import { DashboardTarget } from "./types";
import { DashboardTargetsService } from "./dashboard-targets.service";

interface Props {
  targets: DashboardTarget[];
  lang:    string;
  onClose: () => void;
  onSaved: () => void;
}

export default function DashboardTargetsPanel({ targets, lang, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(targets.map((t) => [t.metric_key, String(t.target_value)]))
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const items = targets.map((t) => ({
        metric_key:   t.metric_key,
        target_value: Number(values[t.metric_key]),
      }));
      await DashboardTargetsService.updateTargets(items);
      onSaved();
      onClose();
    } catch {
      setError(lang === "es" ? "No se pudieron guardar los targets." : "Could not save targets.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={s.modalTitle}>{lang === "es" ? "Configurar Targets" : "Configure Targets"}</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {targets.map((t) => (
            <div key={t.metric_key} style={s.row}>
              <div style={s.rowLabel}>
                {lang === "es" ? t.label_es : t.label_en}
                <span style={s.comparisonHint}>{t.comparison === "gte" ? "≥" : "≤"}</span>
              </div>
              <input
                type="number"
                value={values[t.metric_key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [t.metric_key]: e.target.value }))}
                style={s.input}
              />
              <span style={s.unit}>{t.unit}</span>
            </div>
          ))}
          {error && <div style={{ color: "#ef4444", fontSize: "0.8125rem" }}>{error}</div>}
        </div>

        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onClose}>{lang === "es" ? "Cancelar" : "Cancel"}</button>
          <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? (lang === "es" ? "Guardando..." : "Saving...") : (lang === "es" ? "Guardar" : "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  modalOverlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" },
  modal:        { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl, 16px)", width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", overflow: "hidden" },
  modalHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  modalTitle:   { fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" },
  closeBtn:     { background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--color-text-secondary)", padding: "0.25rem", lineHeight: 1 },
  row:          { display: "flex", alignItems: "center", gap: "0.625rem" },
  rowLabel:     { flex: 1, fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "0.375rem" },
  comparisonHint: { fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 400 },
  input:        { width: 90, padding: "0.375rem 0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text-primary)", fontSize: "0.875rem", textAlign: "right" },
  unit:         { fontSize: "0.8125rem", color: "var(--color-text-secondary)", width: 32 },
  modalFooter:  { display: "flex", justifyContent: "flex-end", gap: "0.625rem", padding: "0.875rem 1.5rem", borderTop: "1px solid var(--color-border)" },
  cancelBtn:    { padding: "0.5rem 1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text-primary)", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 },
  saveBtn:      { padding: "0.5rem 1.25rem", borderRadius: "var(--radius-md)", border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 },
};
