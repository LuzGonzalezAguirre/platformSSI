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

interface TooltipInfo {
  item: EquipmentGridItem;
  x:    number;
  y:    number;
}

export default function EquipmentBubbleGrid({ data, lang }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  if (data.length === 0) return null;

  const departments = [...new Set(data.map((d) => d.department))].sort();
  const maxHours    = Math.max(...data.map((d) => d.hours), 1);

  function radius(hours: number): number {
    return 12 + (hours / maxHours) * 36;
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>
          {lang === "es" ? "Equipos — Carga de Mantenimiento" : "Equipment — Maintenance Load"}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {(["Completed", "In Progress", "Pending", "Open"] as const).map((label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor(label) }} />
              {label}
            </div>
          ))}
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
            · {lang === "es" ? "Tamaño = Horas" : "Size = Hours"}
          </div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        {departments.map((dept) => {
          const items = data.filter((d) => d.department === dept);
          return (
            <div key={dept} style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {dept}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                {items.sort((a, b) => b.hours - a.hours).map((item) => {
                  const r   = radius(item.hours);
                  const col = statusColor(item.dominant_status);
                  return (
                    <div
                      key={item.equipment_id}
                      style={{
                        width:           r * 2,
                        height:          r * 2,
                        borderRadius:    "50%",
                        background:      `${col}22`,
                        border:          `2px solid ${col}`,
                        display:         "flex",
                        alignItems:      "center",
                        justifyContent:  "center",
                        cursor:          "pointer",
                        flexShrink:      0,
                        position:        "relative",
                        transition:      "transform 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.1)";
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ item, x: rect.left, y: rect.top });
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        setTooltip(null);
                      }}
                    >
                      <span style={{
                        fontSize:   Math.max(7, r * 0.35),
                        fontWeight: 700,
                        color:      col,
                        textAlign:  "center",
                        lineHeight: 1.1,
                        padding:    "0.1rem",
                      }}>
                        {item.equipment_id.length > 8 ? item.equipment_id.slice(0, 7) + "…" : item.equipment_id}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {tooltip && (
          <div style={{
            position:      "fixed",
            top:           tooltip.y - 8,
            left:          tooltip.x + 8,
            background:    "var(--color-surface)",
            border:        "1px solid var(--color-border)",
            borderRadius:  "var(--radius-md)",
            padding:       "0.75rem 1rem",
            fontSize:      "0.8125rem",
            zIndex:        1000,
            pointerEvents: "none",
            boxShadow:     "0 4px 16px rgba(0,0,0,0.2)",
            minWidth:      200,
          }}>
            <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>
              {tooltip.item.equipment_id}
            </div>
            <div style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
              {tooltip.item.description}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem 0.75rem", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>Work Requests</span>
              <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{tooltip.item.count}</span>
              <span style={{ color: "var(--color-text-secondary)" }}>Hours</span>
              <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{tooltip.item.hours.toFixed(2)}</span>
              <span style={{ color: "var(--color-text-secondary)" }}>Group</span>
              <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{tooltip.item.group || "—"}</span>
              <span style={{ color: "var(--color-text-secondary)" }}>Status</span>
              <span style={{ fontWeight: 600, color: statusColor(tooltip.item.dominant_status) }}>
                {tooltip.item.dominant_status}
              </span>
            </div>
            {Object.entries(tooltip.item.statuses).length > 1 && (
              <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.375rem" }}>
                {Object.entries(tooltip.item.statuses).map(([st, cnt]) => (
                  <div key={st} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>
                    <span>{st}</span>
                    <span style={{ fontWeight: 600 }}>{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background:   "var(--color-surface)",
  border:       "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding:      "1.25rem",
};
const sectionTitle: React.CSSProperties = {
  fontSize:  "0.875rem",
  fontWeight: 700,
  color:     "var(--color-text-primary)",
  margin:    0,
};