import type { QWallTrendGranularity } from "../services/qwall.service";

// ── GranularityToggle ────────────────────────────────────────────────────────
// Toggle Daily/Week/Month compartido entre ParetoChart y TrendChart.

interface GranularityToggleProps {
  value:    QWallTrendGranularity;
  onChange: (g: QWallTrendGranularity) => void;
  lang?:    "es" | "en";
}

const btnBase: React.CSSProperties = {
  fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem",
  borderRadius: 5, cursor: "pointer", border: "1px solid var(--color-border)",
};

export default function GranularityToggle({ value, onChange, lang = "es" }: GranularityToggleProps) {
  const l = lang === "es";
  const options: { key: QWallTrendGranularity; label: string }[] = [
    { key: "daily",   label: l ? "Día"    : "Daily" },
    { key: "weekly",  label: l ? "Semana" : "Week" },
    { key: "monthly", label: l ? "Mes"    : "Month" },
  ];
  return (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            ...btnBase,
            background: value === o.key ? "#3b82f6" : "var(--color-surface)",
            color:      value === o.key ? "#fff"    : "var(--color-text-secondary)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
