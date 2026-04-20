import { WRKpis } from "./types";

interface Props { kpis: WRKpis; lang: string; }

function KPICard({ label, value, sub, accent = "#3b82f6", wide = false }: {
  label: string; value: string | number; sub?: string; accent?: string; wide?: boolean;
}) {
  return (
    <div style={{
      background:   "var(--color-surface)",
      border:       "1px solid var(--color-border)",
      borderTop:    `3px solid ${accent}`,
      borderRadius: "var(--radius-md)",
      padding:      "1rem 1.25rem",
      gridColumn:   wide ? "span 2" : undefined,
    }}>
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: "0.375rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.375rem" }}>{sub}</div>
      )}
    </div>
  );
}

export default function WRKpiSection({ kpis, lang }: Props) {
  const l = lang === "es";

  // Eficiencia: color semáforo
  const effColor = kpis.efficiency == null ? "#6b7280"
    : kpis.efficiency >= 100 ? "#10b981"
    : kpis.efficiency >= 80  ? "#f59e0b"
    : "#ef4444";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>

      {/* Total WR */}
      <KPICard
        label="Total Work Requests"
        value={kpis.total_wr}
        accent="#3b82f6"
      />

      {/* Horas reales (Equipment Log) */}
      <KPICard
        label={l ? "Horas Reales (Log)" : "Actual Hours (Log)"}
        value={`${kpis.total_maintenance.toFixed(1)} h`}
        sub={`${l ? "Promedio" : "Avg"}: ${kpis.avg_maintenance.toFixed(1)} h/WR`}
        accent="#f59e0b"
      />

      {/* Horas planeadas */}
      <KPICard
        label={l ? "Horas Planeadas" : "Scheduled Hours"}
        value={`${kpis.total_scheduled.toFixed(1)} h`}
        sub={`${l ? "Promedio" : "Avg"}: ${kpis.avg_scheduled.toFixed(1)} h/WR`}
        accent="#6366f1"
      />

      {/* Eficiencia planeado vs real */}
      <KPICard
        label={l ? "Eficiencia (Plan vs Real)" : "Efficiency (Plan vs Actual)"}
        value={kpis.efficiency != null ? `${kpis.efficiency.toFixed(1)}%` : "—"}
        sub={
          kpis.efficiency == null  ? (l ? "Sin datos completos" : "No completed data")
          : kpis.efficiency >= 100 ? (l ? "Dentro del plan ✓" : "Within plan ✓")
          : (l ? "Por encima del plan" : "Over planned time")
        }
        accent={effColor}
      />

      {/* Completados */}
      <KPICard
        label={l ? "Completados" : "Completed"}
        value={`${kpis.completed_pct}%`}
        sub={`${kpis.pending_count} ${l ? "pendientes" : "pending"}`}
        accent="#10b981"
      />

      {/* Backlog */}
      <KPICard
        label="Backlog"
        value={kpis.backlog}
        sub={l ? "WRs vencidos sin completar" : "Overdue WRs"}
        accent={kpis.backlog > 0 ? "#ef4444" : "#10b981"}
      />

      {/* Lead time */}
      <KPICard
        label={l ? "Lead Time Promedio" : "Avg Lead Time"}
        value={kpis.avg_lead_time != null ? `${kpis.avg_lead_time} ${l ? "días" : "days"}` : "—"}
        sub={l ? "Solicitud → Completado" : "Request → Completed"}
        accent="#06b6d4"
      />

      {/* Top failure */}
      <KPICard
        label={l ? "Falla más frecuente" : "Top Failure"}
        value={kpis.top_failure || "—"}
        accent="#8b5cf6"
      />

    </div>
  );
}