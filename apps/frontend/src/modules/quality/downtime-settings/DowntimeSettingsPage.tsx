import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  DowntimeAssignmentService,
  DowntimeWorkcenterRow,
  QWallInspector,
} from "../services/downtimeAssignment.service";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DowntimeSettingsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const l = lang === "es";

  const [date, setDate] = useState(todayStr());
  const [workcenters, setWorkcenters] = useState<DowntimeWorkcenterRow[]>([]);
  const [inspectors, setInspectors] = useState<QWallInspector[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const inp: React.CSSProperties = {
    padding: "0.3rem 0.5rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", fontSize: "0.8rem",
  };
  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.4rem 1rem", borderRadius: "var(--radius-md)",
    border: "none", background: "#3b82f6", color: "#fff",
    cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
  };
  const th: React.CSSProperties = {
    textAlign: "left", padding: "0.4rem 0.6rem", fontWeight: 700,
    color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)",
    fontSize: "0.72rem", textTransform: "uppercase",
  };
  const td: React.CSSProperties = {
    padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--color-border)",
    color: "var(--color-text-primary)",
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [wcs, insp, current] = await Promise.all([
        DowntimeAssignmentService.getWorkcenters(),
        DowntimeAssignmentService.getInspectors(),
        DowntimeAssignmentService.getAssignments(date),
      ]);
      setWorkcenters(wcs);
      setInspectors(insp);
      const map: Record<number, number | null> = {};
      for (const row of current) {
        map[row.workcenter_id] = row.inspector_user_id;
      }
      setAssignments(map);
    } catch {
      setMessage({ text: l ? "Error cargando datos" : "Error loading data", ok: false });
    } finally {
      setLoading(false);
    }
  }, [date, l]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (workcenterId: number, inspectorUserId: number | null) => {
    setAssignments((prev) => ({ ...prev, [workcenterId]: inspectorUserId }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = workcenters.map((wc) => {
        const inspectorId = assignments[wc.id] ?? null;
        const inspector = inspectors.find((i) => i.user_id === inspectorId);
        return {
          workcenter_id: wc.id,
          inspector_user_id: inspectorId,
          inspector_name: inspector ? inspector.name : null,
        };
      });
      await DowntimeAssignmentService.saveAssignments(date, payload);
      setMessage({ text: l ? "Guardado correctamente." : "Saved successfully.", ok: true });
    } catch {
      setMessage({ text: l ? "Error al guardar." : "Error saving.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          {l ? "Downtime — Asignación de Inspectores" : "Downtime — Inspector Assignment"}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="date" value={date} max={todayStr()} style={inp} onChange={(e) => setDate(e.target.value)} />
          <button style={btn} onClick={handleSave} disabled={saving || loading}>
            {saving ? (l ? "Guardando..." : "Saving...") : (l ? "Guardar" : "Save")}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", fontSize: "0.8rem",
          background: message.ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${message.ok ? "#bbf7d0" : "#fecaca"}`,
          color: message.ok ? "#15803d" : "#b91c1c",
        }}>
          {message.text}
        </div>
      )}

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.75rem" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
            {l ? "Cargando..." : "Loading..."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th style={th}>Workcenter</th>
                <th style={th}>{l ? "Grupo" : "Group"}</th>
                <th style={th}>{l ? "Inspector" : "Inspector"}</th>
              </tr>
            </thead>
            <tbody>
              {workcenters.map((wc) => (
                <tr key={wc.id}>
                  <td style={td}>{wc.name}</td>
                  <td style={{ ...td, color: "var(--color-text-secondary)" }}>{wc.workcenter_group}</td>
                  <td style={td}>
                    <select
                      style={{ ...inp, width: "100%" }}
                      value={assignments[wc.id] ?? ""}
                      onChange={(e) => handleChange(wc.id, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">{l ? "— Sin asignar —" : "— Unassigned —"}</option>
                      {inspectors.map((insp) => (
                        <option key={insp.user_id} value={insp.user_id}>{insp.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}