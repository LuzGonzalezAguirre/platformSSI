import { MaintenanceKPIs,OEEData  } from "./types";

interface Props {
  kpis: MaintenanceKPIs | null;
  oee:  OEEData | null;
  lang: string;
}
function kpiColor(value: number, target: number, lowerBetter = false): string {
  if (lowerBetter) return value <= target ? "#10b981" : value <= target * 1.5 ? "#f59e0b" : "#ef4444";
  return value >= target ? "#10b981" : value >= target * 0.9 ? "#f59e0b" : "#ef4444";
}

function KPIBar({ label, value, target, unit = "%", lowerBetter = false }: {
  label: string; value: number; target: number; unit?: string; lowerBetter?: boolean;
}) {
  const color   = kpiColor(value, target, lowerBetter);
  const fillPct = lowerBetter
    ? Math.min((target / Math.max(value, 0.01)) * 100, 100)
    : Math.min((value / target) * 100, 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
        <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>
          {value != null ? `${value.toFixed(1)}${unit}` : "—"}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${fillPct}%`, background: color, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
        Target: {target}{unit}
      </div>
    </div>
  );
}

function DonutChart({ value, color, size = 100 }: { value: number; color: string; size?: number }) {
  const r    = 38;
  const circ = 2 * Math.PI * r;
  const fill = Math.min((value / 100) * circ, circ);
  const cx   = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-border)" strokeWidth={9} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
          {value.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default function KPISection({ kpis, oee, lang }: Props) {
  const avail:       number = oee ? parseFloat(oee.availability_pct) : (kpis?.availability_pct ?? 0);
  const performance: number = oee ? parseFloat(oee.performance_pct)  : 0;
  const quality:     number = oee ? parseFloat(oee.quality_pct)      : 0;
  const oeePct:      number = oee ? parseFloat(oee.oee_pct)          : 0;

  const items = [
    { label: lang === "es" ? "Disponibilidad" : "Availability", value: avail,       target: 90,  color: "#3b82f6" },
    { label: "SSI Performance",                                  value: performance, target: 85,  color: "#8b5cf6" },
    { label: lang === "es" ? "Calidad" : "Quality",             value: quality,     target: 98,  color: "#10b981" },
    { label: "OEE",                                              value: oeePct,      target: 65,  color: "#f59e0b" },
  ];

  return (
    <div style={card}>
      <div style={sectionTitle}>
        {lang === "es" ? "Indicadores Clave de Desempeño" : "Key Performance Metrics"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem", alignItems: "center" }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <DonutChart value={item.value} color={item.color} />
            <div style={{ width: "100%" }}>
              <KPIBar label={item.label} value={item.value} target={item.target} />
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