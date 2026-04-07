import { GroupedItem } from "./types";

interface Props { data: GroupedItem[]; lang: string; }

export default function TechnicianChart({ data, lang }: Props) {
  const l   = lang === "es";
  const max = Math.max(...data.map((d) => d.hours), 1);

  return (
    <div style={card}>
      <div style={sectionTitle}>{l ? "Carga por Técnico" : "Technician Workload"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {data.slice(0, 10).map((item) => (
          <div key={item.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: "0.2rem" }}>
              <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                {item.label === "Unassigned" ? (l ? "Sin asignar" : "Unassigned") : item.label}
              </span>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <span style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem" }}>
                  {item.count} WR
                </span>
                <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {item.hours.toFixed(1)} hrs
                </span>
              </div>
            </div>
            <div style={{ height: 10, background: "var(--color-border)", borderRadius: 5 }}>
              <div style={{
                height: "100%", width: `${(item.hours / max) * 100}%`,
                background: item.label === "Unassigned" ? "#6b7280" : "#3b82f6",
                borderRadius: 5, transition: "width 0.4s",
              }} />
            </div>
          </div>
        ))}
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