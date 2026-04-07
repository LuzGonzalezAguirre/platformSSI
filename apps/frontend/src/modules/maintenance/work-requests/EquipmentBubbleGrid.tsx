import { useState } from "react";
import { EquipmentGridItem } from "./types";

interface Props { data: EquipmentGridItem[]; lang: string; }

const STATUS_COLOR: Record<string, string> = {
  completed:     "#10b981",
  complete:      "#10b981",
  "in progress": "#f59e0b",
  pending:       "#ef4444",
  open:          "#3b82f6",
};

function statusColor(status: string): string {
  const key = status.toLowerCase();
  return Object.entries(STATUS_COLOR).find(([k]) => key.includes(k))?.[1] ?? "#6b7280";
}

// ─── Gráfica resumen por Equipment_Group ──────────────────────────────────────
function GroupSummaryChart({ data, lang }: { data: EquipmentGridItem[]; lang: string }) {
  const l = lang === "es";

  const groupMap = new Map<string, { hours: number; count: number }>();
  data.forEach((item) => {
    const g = item.group || (l ? "Sin Grupo" : "No Group");
    if (!groupMap.has(g)) groupMap.set(g, { hours: 0, count: 0 });
    const acc = groupMap.get(g)!;
    acc.hours += item.hours;
    acc.count += item.count;
  });

  const groups = [...groupMap.entries()].sort((a, b) => b[1].hours - a[1].hours);
  const maxH   = Math.max(...groups.map(([, v]) => v.hours), 1);
  const totalH = groups.reduce((s, [, v]) => s + v.hours, 0);
  const PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"];

  return (
    <div style={{ marginBottom: "1.25rem", padding: "1rem", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
        {l ? "Resumen por Grupo de Equipo" : "Summary by Equipment Group"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.25rem", alignItems: "center" }}>
        {/* Barras horizontales */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {groups.map(([group, val], idx) => {
            const col    = PALETTE[idx % PALETTE.length];
            const barPct = (val.hours / maxH) * 100;
            const pct    = Math.round((val.hours / totalH) * 100);
            return (
              <div key={group} style={{ display: "grid", gridTemplateColumns: "150px 1fr 56px 34px", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={group}>
                    {group}
                  </span>
                </div>
                <div style={{ position: "relative", height: 16, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: `${barPct}%`, height: "100%", background: col, opacity: 0.75, borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: col, textAlign: "right", whiteSpace: "nowrap" }}>
                  {val.hours.toFixed(1)} h
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textAlign: "right" }}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Mini donut */}
        {(() => {
          const size = 80; const cx = 40; const cy = 40; const r = 30; const stroke = 11;
          const circ = 2 * Math.PI * r;
          let off = 0;
          const arcs = groups.map(([group, val], idx) => {
            const dash = circ * (val.hours / totalH);
            const arc  = { group, dash, off, col: PALETTE[idx % PALETTE.length] };
            off += dash;
            return arc;
          });
          return (
            <svg width={size} height={size} style={{ flexShrink: 0 }}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
              {arcs.map((arc) => (
                <circle key={arc.group} cx={cx} cy={cy} r={r} fill="none"
                  stroke={arc.col} strokeWidth={stroke}
                  strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
                  strokeDashoffset={-arc.off + circ * 0.25} />
              ))}
              <text x={cx} y={cy - 3} textAnchor="middle" fontSize={12} fontWeight="700" fill="var(--color-text-primary)">
                {groups.length}
              </text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={7} fill="var(--color-text-secondary)">
                {l ? "grupos" : "groups"}
              </text>
            </svg>
          );
        })()}
      </div>
    </div>
  );
}

const card: React.CSSProperties         = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" };

export default function EquipmentBubbleGrid({ data, lang }: Props) {
  const l = lang === "es";

  // El primer grupo abierto por defecto, el resto colapsado
  const buildInitialOpen = (groups: [string, EquipmentGridItem[]][]) => {
    const init: Record<string, boolean> = {};
    groups.forEach(([g], idx) => { init[g] = idx === 0; });
    return init;
  };

  const groupMap = new Map<string, EquipmentGridItem[]>();
  data.forEach((item) => {
    const g = item.group || (l ? "Sin Grupo" : "No Group");
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(item);
  });
  const groups = [...groupMap.entries()].sort((a, b) => {
    const ha = a[1].reduce((s, i) => s + i.hours, 0);
    const hb = b[1].reduce((s, i) => s + i.hours, 0);
    return hb - ha;
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => buildInitialOpen(groups));

  if (data.length === 0) return null;

  const maxHours = Math.max(...data.map((d) => d.hours), 1);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  function toggleGroup(group: string) {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>
          {l ? "Equipos — Carga de Mantenimiento" : "Equipment — Maintenance Load"}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {(["Completed", "In Progress", "Pending", "Open"] as const).map((label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: statusColor(label) }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Gráfica resumen — siempre visible */}
      <GroupSummaryChart data={data} lang={l ? "es" : "en"} />

      {/* Desplegables por Equipment_Group */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {groups.map(([group, items]) => {
          const sortedItems = [...items].sort((a, b) => b.hours - a.hours);
          const groupHours  = sortedItems.reduce((s, i) => s + i.hours, 0);
          const groupCount  = sortedItems.reduce((s, i) => s + i.count, 0);
          const isOpen      = openGroups[group] ?? false;

          return (
            <div key={group} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              {/* Header del desplegable */}
              <div
                onClick={() => toggleGroup(group)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0.875rem", cursor: "pointer", background: isOpen ? "var(--color-border)" : "transparent", userSelect: "none", transition: "background 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
                    {isOpen ? "▼" : "▶"}
                  </span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {group}
                  </span>
                  <span style={{ fontSize: "0.7rem", background: "var(--color-border)", borderRadius: 10, padding: "0.05rem 0.45rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                    {sortedItems.length} {l ? "equipos" : "equip."}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem" }}>
                  <span style={{ fontWeight: 700, color: "#3b82f6" }}>{groupHours.toFixed(1)} h</span>
                  <span style={{ fontWeight: 700, color: "#f59e0b" }}>{groupCount} WR</span>
                </div>
              </div>

              {/* Contenido colapsable */}
              {isOpen && (
                <div style={{ padding: "0.75rem 0.875rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {sortedItems.map((item) => {
                    const col         = statusColor(item.dominant_status);
                    const barPctH     = (item.hours / maxHours) * 100;
                    const barPctC     = (item.count / maxCount) * 100;
                    const displayName = item.description || item.equipment_id;
                    const labelShort  = displayName.length > 28 ? displayName.slice(0, 26) + "…" : displayName;

                    return (
                      <div key={item.equipment_id} style={{ display: "grid", gridTemplateColumns: "190px 1fr 56px 40px", gap: "0.5rem", alignItems: "center" }}>
                        {/* Nombre — description arriba, ID abajo en gris */}
                        <div title={`${displayName} (${item.equipment_id})`}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
                            <span style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {labelShort}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.67rem", color: "var(--color-text-secondary)", paddingLeft: 13 }}>
                            {item.equipment_id}
                          </div>
                        </div>

                        {/* Barra doble: fondo = horas, franja = count */}
                        <div style={{ position: "relative", height: 22, background: "var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ position: "absolute", top: 0, left: 0, width: `${barPctH}%`, height: "100%", background: `${col}33`, borderRadius: 4, transition: "width 0.4s ease" }} />
                          <div style={{ position: "absolute", bottom: 0, left: 0, width: `${barPctC}%`, height: "6px", background: col, opacity: 0.85 }} />
                        </div>

                        <div style={{ fontSize: "0.775rem", fontWeight: 700, color: "#3b82f6", textAlign: "right", whiteSpace: "nowrap" }}>
                          {item.hours.toFixed(1)} h
                        </div>
                        <div style={{ fontSize: "0.775rem", fontWeight: 700, color: col, textAlign: "right" }}>
                          {item.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda pie */}
      <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem", fontSize: "0.7rem", color: "var(--color-text-secondary)", borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem" }}>
        <span>█ {l ? "Barra fondo = Horas" : "Bar background = Hours"}</span>
        <span>▬ {l ? "Franja inferior = Cant. WR" : "Bottom stripe = WR Count"}</span>
      </div>
    </div>
  );
}