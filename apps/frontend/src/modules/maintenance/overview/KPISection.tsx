import { MaintenanceKPIs, OEEData, DashboardTarget } from "./types";

interface Props {
  kpis: MaintenanceKPIs | null;
  oee:  OEEData | null;
  lang: string;
  getTarget: (metricKey: string) => DashboardTarget | undefined;
}

function kpiColor(value: number, target: number, lowerBetter = false): string {
  if (lowerBetter) return value <= target ? "#10b981" : value <= target * 1.5 ? "#f59e0b" : "#ef4444";
  return value >= target ? "#10b981" : value >= target * 0.9 ? "#f59e0b" : "#ef4444";
}

function KPIBar({ label, value, target, unit = "%", lowerBetter = false }: {
  label: string; value: number | null; target: number; unit?: string; lowerBetter?: boolean;
}) {
  const safeVal = value ?? 0;
  const color   = kpiColor(safeVal, target, lowerBetter);
  const fillPct = lowerBetter
    ? Math.min((target / Math.max(safeVal, 0.01)) * 100, 100)
    : Math.min((safeVal / target) * 100, 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
        <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>
          {value != null ? `${safeVal.toFixed(1)}${unit}` : "—"}
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

export default function KPISection({ kpis, oee, lang, getTarget }: Props) {
  // Lee valores reales del prop oee (OEEData tiene strings → parseFloat)
  const avail       = oee?.availability_pct != null ? parseFloat(oee.availability_pct as unknown as string) : null;
  const performance = oee?.performance_pct  != null ? parseFloat(oee.performance_pct  as unknown as string) : null;
  const quality     = oee?.quality_pct      != null ? parseFloat(oee.quality_pct      as unknown as string) : null;
  const oeePct      = oee?.oee_pct          != null ? parseFloat(oee.oee_pct          as unknown as string) : null;

  const items = [
    { label: lang === "es" ? "Disponibilidad" : "Availability", value: avail,       target: getTarget("availability")?.target_value ?? 90 },
    { label: "SSI Performance",                                  value: performance, target: getTarget("performance")?.target_value  ?? 85 },
    { label: lang === "es" ? "Calidad" : "Quality",             value: quality,     target: getTarget("quality")?.target_value      ?? 98 },
    { label: "OEE",                                              value: oeePct,      target: getTarget("oee")?.target_value          ?? 65 },
  ];

  return (
    <div style={card}>
      <div style={sectionTitle}>
        {lang === "es" ? "Indicadores Clave de Desempeño" : "Key Performance Metrics"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem", alignItems: "stretch" }}>
        {items.map((item) => (
          <KPIBar key={item.label} label={item.label} value={item.value} target={item.target} />
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