import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  DowntimeAssignmentService,
  DowntimeAssignmentTree,
  DowntimeGroupWrite,
  DowntimeOverrideWrite,
  QWallInspector,
  scopeId,
} from "../services/downtimeAssignment.service";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DowntimeSettingsPage() {
  const { i18n } = useTranslation();
  const l = i18n.language.startsWith("es");
  const navigate = useNavigate();

  const [date, setDate] = useState(todayStr());
  const [tree, setTree] = useState<DowntimeAssignmentTree | null>(null);
  const [inspectors, setInspectors] = useState<QWallInspector[]>([]);
  const [scopeValue, setScopeValue] = useState<Record<string, number | null>>({});
  const [touchedScopes, setTouchedScopes] = useState<Set<string>>(new Set());
  const [wcOverride, setWcOverride] = useState<Record<number, number | null>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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
  const ghostBtn: React.CSSProperties = {
    ...inp, display: "flex", alignItems: "center", gap: "0.35rem",
    cursor: "pointer", fontWeight: 600, color: "var(--color-text-secondary)",
  };
  const th: React.CSSProperties = {
    textAlign: "left", padding: "0.35rem 0.6rem", fontWeight: 700,
    color: "var(--color-text-secondary)", fontSize: "0.68rem",
    textTransform: "uppercase", borderBottom: "1px solid var(--color-border)",
  };
  const td: React.CSSProperties = {
    padding: "0.3rem 0.6rem", borderBottom: "1px solid var(--color-border)",
    color: "var(--color-text-primary)", fontSize: "0.8rem",
  };
  const badge: React.CSSProperties = {
    fontSize: "0.64rem", fontWeight: 700, padding: "0.05rem 0.35rem",
    borderRadius: "var(--radius-sm, 4px)", background: "#fef3c7",
    color: "#92400e", whiteSpace: "nowrap",
  };
  const overrideBadge: React.CSSProperties = {
    ...badge, background: "#dbeafe", color: "#1e40af",
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [data, insp] = await Promise.all([
        DowntimeAssignmentService.getTree(date),
        DowntimeAssignmentService.getInspectors(),
      ]);
      setTree(data);
      setInspectors(insp);

      const scopes: Record<string, number | null> = {};
      const overrides: Record<number, number | null> = {};
      const open: Record<string, boolean> = {};

      for (const group of data.groups) {
        open[group.group_key] = false;
        for (const sub of group.subgroups) {
          scopes[scopeId(sub.group_key, sub.subgroup_key)] = sub.inspector_user_id;
          for (const wc of sub.workcenters) {
            if (wc.source === "workcenter") {
              overrides[wc.workcenter_id] = wc.inspector_user_id;
            }
          }
        }
      }

      setScopeValue(scopes);
      setWcOverride(overrides);
      setTouchedScopes(new Set());
      setOpenGroups(open);
    } catch {
      setMessage({ text: l ? "Error cargando datos" : "Error loading data", ok: false });
    } finally {
      setLoading(false);
    }
  }, [date, l]);

  useEffect(() => { void load(); }, [load]);

  const inspectorName = useCallback(
    (id: number | null) => inspectors.find((i) => i.user_id === id)?.name ?? null,
    [inspectors],
  );

  /** Asignar a nivel scope limpia los overrides de ese scope: "aplica a todos". */
  const handleScopeChange = (
    groupKey: string,
    subgroupKey: string,
    workcenterIds: number[],
    value: number | null,
  ) => {
    const key = scopeId(groupKey, subgroupKey);
    setScopeValue((prev) => ({ ...prev, [key]: value }));
    setTouchedScopes((prev) => new Set(prev).add(key));
    setWcOverride((prev) => {
      const next = { ...prev };
      for (const id of workcenterIds) delete next[id];
      return next;
    });
  };

  const handleWorkcenterChange = (workcenterId: number, value: number | null) => {
    setWcOverride((prev) => ({ ...prev, [workcenterId]: value }));
  };

  const clearOverride = (workcenterId: number) => {
    setWcOverride((prev) => {
      const next = { ...prev };
      delete next[workcenterId];
      return next;
    });
  };

  const toggleAll = (open: boolean) => {
    if (!tree) return;
    const next: Record<string, boolean> = {};
    for (const g of tree.groups) next[g.group_key] = open;
    setOpenGroups(next);
  };

  const handleSave = async () => {
    if (!tree) return;
    setSaving(true);
    setMessage(null);
    try {
      const groups: DowntimeGroupWrite[] = [];
      for (const group of tree.groups) {
        for (const sub of group.subgroups) {
          const key = scopeId(sub.group_key, sub.subgroup_key);
          const value = scopeValue[key] ?? null;
          if (value === null && !touchedScopes.has(key)) continue;
          groups.push({
            group_key: sub.group_key,
            subgroup_key: sub.subgroup_key,
            inspector_user_id: value,
            inspector_name: inspectorName(value),
          });
        }
      }

      const overrides: DowntimeOverrideWrite[] = Object.entries(wcOverride).map(
        ([id, value]) => ({
          workcenter_id: Number(id),
          inspector_user_id: value,
          inspector_name: inspectorName(value),
        }),
      );

      await DowntimeAssignmentService.saveAssignments(date, groups, overrides);
      setMessage({ text: l ? "Guardado correctamente." : "Saved successfully.", ok: true });
      await load();
    } catch {
      setMessage({ text: l ? "Error al guardar." : "Error saving.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const InspectorSelect = ({
    value, onChange, width,
  }: { value: number | null; onChange: (v: number | null) => void; width?: string }) => (
    <select
      style={{ ...inp, width: width ?? "100%" }}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">{l ? "— Sin asignar —" : "— Unassigned —"}</option>
      {inspectors.map((insp) => (
        <option key={insp.user_id} value={insp.user_id}>{insp.name}</option>
      ))}
    </select>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            style={ghostBtn}
            onClick={() => navigate("/quality/downtime")}
            title={l ? "Volver a Downtime" : "Back to Downtime"}
          >
            <ArrowLeft size={15} />
            <span>{l ? "Downtime" : "Downtime"}</span>
          </button>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            {l ? "Asignación de Inspectores" : "Inspector Assignment"}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <button style={ghostBtn} onClick={() => toggleAll(true)}>
            {l ? "Expandir todo" : "Expand all"}
          </button>
          <button style={ghostBtn} onClick={() => toggleAll(false)}>
            {l ? "Colapsar todo" : "Collapse all"}
          </button>
          <input type="date" value={date} style={inp} onChange={(e) => setDate(e.target.value)} />
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

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
          {l ? "Cargando..." : "Loading..."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {(tree?.groups ?? []).map((group) => {
            const isOpen = openGroups[group.group_key] ?? false;
            return (
              <div key={group.group_key} style={{
                background: "var(--color-surface)", border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)", overflow: "hidden",
              }}>
                <button
                  onClick={() => setOpenGroups((p) => ({ ...p, [group.group_key]: !isOpen }))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.6rem 0.75rem", border: "none", background: "transparent",
                    cursor: "pointer", color: "var(--color-text-primary)",
                    fontSize: "0.85rem", fontWeight: 700, textAlign: "left",
                  }}
                >
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span>{group.label}</span>
                  <span style={{ fontWeight: 500, fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>
                    {group.workcenter_count} WC
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 0.75rem 0.75rem" }}>
                    {group.subgroups.map((sub) => {
                      const key = scopeId(sub.group_key, sub.subgroup_key);
                      const wcIds = sub.workcenters.map((w) => w.workcenter_id);
                      const scopeInherited = sub.inherited_from && !touchedScopes.has(key);
                      return (
                        <div key={key} style={{ marginTop: "0.5rem" }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            flexWrap: "wrap", padding: "0.4rem 0.5rem",
                            background: "var(--color-bg-secondary, #f1f5f9)",
                            borderRadius: "var(--radius-md)",
                          }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                              {sub.subgroup_key ? sub.label : (l ? "Todo el grupo" : "Whole group")}
                            </span>
                            {scopeInherited && (
                              <span style={badge}>
                                {l ? `heredado ${sub.inherited_from}` : `inherited ${sub.inherited_from}`}
                              </span>
                            )}
                            <div style={{ marginLeft: "auto", minWidth: "14rem" }}>
                              <InspectorSelect
                                value={scopeValue[key] ?? null}
                                onChange={(v) => handleScopeChange(sub.group_key, sub.subgroup_key, wcIds, v)}
                              />
                            </div>
                          </div>

                          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.25rem" }}>
                            <thead>
                              <tr>
                                <th style={th}>Workcenter</th>
                                <th style={{ ...th, width: "16rem" }}>{l ? "Inspector" : "Inspector"}</th>
                                <th style={{ ...th, width: "2.5rem" }} />
                              </tr>
                            </thead>
                            <tbody>
                              {sub.workcenters.map((wc) => {
                                const hasOverride = Object.prototype.hasOwnProperty.call(
                                  wcOverride, wc.workcenter_id,
                                );
                                const effective = hasOverride
                                  ? wcOverride[wc.workcenter_id]
                                  : scopeValue[key] ?? null;
                                const showInherited =
                                  !hasOverride && !touchedScopes.has(key) && !!wc.inherited_from;
                                return (
                                  <tr key={wc.workcenter_id}>
                                    <td style={td}>
                                      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                        {wc.workcenter_name}
                                        {hasOverride && (
                                          <span style={overrideBadge}>{l ? "override" : "override"}</span>
                                        )}
                                        {showInherited && (
                                          <span style={badge}>
                                            {l ? `heredado ${wc.inherited_from}` : `inherited ${wc.inherited_from}`}
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                    <td style={td}>
                                      <InspectorSelect
                                        value={effective}
                                        onChange={(v) => handleWorkcenterChange(wc.workcenter_id, v)}
                                      />
                                    </td>
                                    <td style={{ ...td, textAlign: "center" }}>
                                      {hasOverride && (
                                        <button
                                          onClick={() => clearOverride(wc.workcenter_id)}
                                          title={l ? "Volver al valor del grupo" : "Revert to group value"}
                                          style={{
                                            border: "none", background: "transparent", cursor: "pointer",
                                            color: "var(--color-text-secondary)", padding: "0.15rem",
                                            display: "flex", alignItems: "center",
                                          }}
                                        >
                                          <RotateCcw size={14} />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}