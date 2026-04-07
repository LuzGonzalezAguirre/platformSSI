import { GroupedItem } from "./types";

interface Props {
  byFailure:  GroupedItem[];
  byType:     GroupedItem[];
  byAction:   GroupedItem[];
  lang:       string;
}

function HBar({ items, valueKey, label, color }: {
  items: GroupedItem[]; valueKey: "count" | "hours"; label: string; color: string;
}) {
  const max = Math.max(...items.map((i) => i[valueKey]), 1);
  return (
    <div>
      <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.625rem" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.slice(0, 8).map((item) => (
          <div key={item.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{item.label || "—"}</span>
              <span style={{ color: "var(--color-text-secondary)" }}>
                {valueKey === "hours" ? `${item[valueKey].toFixed(1)}h` : item[valueKey]}
              </span>
            </div>
            <div style={{ height: 8, background: "var(--color-border)", borderRadius: 4 }}>
              <div style={{ height: "100%", width: `${(item[valueKey] / max) * 100}%`, background: color, borderRadius: 4, transition: "width 0.4s" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FailureBreakdown({ byFailure, byType, byAction, lang }: Props) {
  const l = lang === "es";
  return (
    <div style={card}>
      <div style={sectionTitle}>{l ? "Análisis de Fallas" : "Failure Analysis"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
        <HBar items={byFailure} valueKey="count" label={l ? "Por Falla (Top 8)" : "By Failure (Top 8)"} color="#ef4444" />
        <HBar items={byType}    valueKey="hours" label={l ? "Por Tipo (Horas)"  : "By Type (Hours)"}   color="#8b5cf6" />
        <HBar items={byAction}  valueKey="count" label={l ? "Por Acción"        : "By Action"}          color="#f59e0b" />
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)", padding: "1.25rem",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "1rem",
};