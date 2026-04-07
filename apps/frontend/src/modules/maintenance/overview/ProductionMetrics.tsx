import { MaintenanceKPIs } from "./types";

interface Props { kpis: MaintenanceKPIs | null; lang: string; }

function MetricCard({ label, value, unit = "hrs", accent = "#3b82f6" }: {
  label: string; value: number | null; unit?: string; accent?: string;
}) {
  return (
    <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "1rem", borderLeft: `3px solid ${accent}` }}>
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.375rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
        {value != null ? value.toFixed(2) : "—"}
        <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>{unit}</span>
      </div>
    </div>
  );
}

export default function ProductionMetrics({ kpis, lang }: Props) {
  const planHours = kpis
    ? (kpis.operating_hours ?? 0) + (kpis.downtime_hours ?? 0)
    : null;

  return (
    <div style={card}>
      <div style={sectionTitle}>
        {lang === "es" ? "Métricas de Producción" : "Production Metrics"}
      </div>

      {/* Horas principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.875rem", marginBottom: "1rem" }}>
        <MetricCard label={lang === "es" ? "Horas Operando"   : "Operating Hours"}  value={kpis?.operating_hours ?? null}  accent="#10b981" />
        <MetricCard label={lang === "es" ? "Horas de Paro"    : "Downtime Hours"}   value={kpis?.downtime_hours ?? null}   accent="#ef4444" />
        <MetricCard label={lang === "es" ? "Horas Plan"       : "Plan Hours"}       value={planHours}                      accent="#3b82f6" />
      </div>

      {/* Desglose secundario */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem", marginBottom: "1rem" }}>
        <MetricCard label="Down Hours"   value={kpis?.down_hours   ?? null} accent="#ef4444" />
        <MetricCard label="Setup Hours"  value={kpis?.setup_hours  ?? null} accent="#f59e0b" />
        <MetricCard label="Idle Hours"   value={kpis?.idle_hours   ?? null} accent="#6b7280" />
        <MetricCard label={lang === "es" ? "Núm. Fallas" : "Total Failures"} value={kpis?.total_failures ?? null} unit="" accent="#8b5cf6" />
      </div>

      {/* MTTR / MTBF destacados */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
        <div style={mtCard}>
          <div style={mtLabel}>MTTR</div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
            {lang === "es" ? "Tiempo Medio de Reparación" : "Mean Time To Repair"}
          </div>
          <div style={mtValue("#ef4444")}>
            {kpis?.mttr_hours != null ? `${kpis.mttr_hours.toFixed(2)} hrs` : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
            {lang === "es" ? "Meta: ≤ 2 hrs" : "Target: ≤ 2 hrs"}
          </div>
        </div>
        <div style={mtCard}>
          <div style={mtLabel}>MTBF</div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
            {lang === "es" ? "Tiempo Medio Entre Fallas" : "Mean Time Between Failures"}
          </div>
          <div style={mtValue("#10b981")}>
            {kpis?.mtbf_hours != null ? `${kpis.mtbf_hours.toFixed(2)} hrs` : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
            {lang === "es" ? "Meta: ≥ 40 hrs" : "Target: ≥ 40 hrs"}
          </div>
        </div>
      </div>
    </div>
  );
}

function mtValue(color: string): React.CSSProperties {
  return { fontSize: "2rem", fontWeight: 800, color };
}

const mtCard: React.CSSProperties = {
  background: "var(--color-bg)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)", padding: "1.25rem",
};
const mtLabel: React.CSSProperties = {
  fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.25rem",
};
const card: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)", padding: "1.25rem",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "1rem",
};