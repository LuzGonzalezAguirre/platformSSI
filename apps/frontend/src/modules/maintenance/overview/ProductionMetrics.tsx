import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { MaintenanceKPIs, DashboardTarget } from "./types";

interface Props {
  kpis: MaintenanceKPIs | null;
  lang: string;
  getTarget: (metricKey: string) => DashboardTarget | undefined;
}

const NARROW_BREAKPOINT = 1150;

// MTTR: lower is better → verde si ≤ target
// MTBF: higher is better → verde si ≥ target
function metricColor(value: number | null, target: number, lowerBetter: boolean): string {
  if (value == null) return "var(--color-text-secondary)";
  if (lowerBetter) {
    return value <= target ? "#10b981" : value <= target * 1.5 ? "#f59e0b" : "#ef4444";
  }
  return value >= target ? "#10b981" : value >= target * 0.9 ? "#f59e0b" : "#ef4444";
}

function MetricCard({ label, value, unit = "hrs", accent = "#3b82f6", valueColor, tooltip, warn }: {
  label: string; value: number | null; unit?: string; accent?: string;
  valueColor?: string; tooltip?: string; warn?: boolean;
}) {
  return (
    <div title={tooltip} style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "1rem", borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.375rem" }}>
        {label}
        {warn && <AlertTriangle size={11} style={{ color: "#ef4444", flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: valueColor ?? "var(--color-text-primary)" }}>
        {value != null ? value.toFixed(2) : "—"}
        <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>{unit}</span>
      </div>
    </div>
  );
}

export default function ProductionMetrics({ kpis, lang, getTarget }: Props) {
  const [narrow, setNarrow] = useState(window.innerWidth < NARROW_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const planHours = kpis
    ? (kpis.operating_hours ?? 0) + (kpis.down_hours ?? 0)
    : null;

  const mttrTarget = getTarget("mttr")?.target_value ?? 2;
  const mtbfTarget = getTarget("mtbf")?.target_value ?? 40;

  const mttrColor = metricColor(kpis?.mttr_hours ?? null, mttrTarget, true);
  const mtbfColor = metricColor(kpis?.mtbf_hours ?? null, mtbfTarget, false);

  // Dos arrays separados a propósito: si el layout unificado de 8 columnas
  // no se lee bien, revertir es solo cambiar el render de abajo para volver
  // a dos grids (6 + 2) usando estos mismos arrays — no hace falta reescribir nada más.
  const mainItems = [
    { label: lang === "es" ? "Horas Operando" : "Operating Hours", value: kpis?.operating_hours ?? null, accent: "#10b981" },
    { label: lang === "es" ? "Horas de Paro"  : "Downtime Hours",  value: kpis?.down_hours  ?? null, accent: "#ef4444" },
    { label: lang === "es" ? "Horas Planeadas" : "Planned Hours",  value: planHours,                 accent: "#3b82f6" },
    { label: "Idle Hours",  value: kpis?.idle_hours   ?? null, accent: "#6b7280" },
    { label: lang === "es" ? "Núm. Fallas" : "Total Failures", value: kpis?.total_failures ?? null, unit: "", accent: "#8b5cf6" },
  ];

  const mtItems = [
    {
      label: "MTTR", value: kpis?.mttr_hours ?? null, accent: mttrColor, valueColor: mttrColor,
      tooltip: lang === "es" ? `Meta: ≤ ${mttrTarget} hrs` : `Target: ≤ ${mttrTarget} hrs`,
      warn: kpis?.mttr_hours != null && kpis.mttr_hours > mttrTarget,
    },
    {
      label: "MTBF", value: kpis?.mtbf_hours ?? null, accent: mtbfColor, valueColor: mtbfColor,
      tooltip: lang === "es" ? `Meta: ≥ ${mtbfTarget} hrs` : `Target: ≥ ${mtbfTarget} hrs`,
    },
  ];

  const allItems = [...mainItems, ...mtItems];

  return (
    <div style={card}>
      <div style={sectionTitle}>
        {lang === "es" ? "Métricas de Producción" : "Production Metrics"}
      </div>

      {/* Una sola hilera de 7 (5 métricas + MTTR/MTBF) — colapsa a 4 columnas en pantallas angostas */}
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "repeat(4, 1fr)" : "repeat(7, 1fr)", gap: "0.875rem" }}>
        {allItems.map((item) => (
          <MetricCard key={item.label} {...item} />
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
