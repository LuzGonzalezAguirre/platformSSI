import { WRKpis } from "./types";

interface Props { kpis: WRKpis; lang: string; }

function KPICard({ label, value, sub, accent = "#3b82f6", wide = false }: {
  label: string; value: string | number; sub?: string; accent?: string; wide?: boolean;
}) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderTop: `3px solid ${accent}`,
      borderRadius: "var(--radius-md)",
      padding: "1rem 1.25rem",
      gridColumn: wide ? "span 2" : undefined,
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
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
      <KPICard
        label="Total Work Requests"
        value={kpis.total_wr}
        accent="#3b82f6"
      />
      <KPICard
        label={l ? "Horas de Mantenimiento" : "Maintenance Hours"}
        value={`${kpis.total_hours.toFixed(1)} hrs`}
        sub={`${l ? "Promedio" : "Avg"}: ${kpis.avg_hours.toFixed(1)} hrs/WR`}
        accent="#f59e0b"
      />
      <KPICard
        label={l ? "Completados" : "Completed"}
        value={`${kpis.completed_pct}%`}
        sub={`${kpis.pending_count} ${l ? "pendientes" : "pending"}`}
        accent="#10b981"
      />
      <KPICard
        label="Backlog"
        value={kpis.backlog}
        sub={l ? "WRs vencidos sin completar" : "Overdue WRs"}
        accent={kpis.backlog > 0 ? "#ef4444" : "#10b981"}
      />
      <KPICard
        label={l ? "Falla más frecuente" : "Top Failure"}
        value={kpis.top_failure || "—"}
        accent="#8b5cf6"
        wide
      />
      <KPICard
        label={l ? "Lead Time Promedio" : "Avg Lead Time"}
        value={kpis.avg_lead_time != null ? `${kpis.avg_lead_time} ${l ? "días" : "days"}` : "—"}
        sub={l ? "Solicitud → Completado" : "Request → Completed"}
        accent="#06b6d4"
      />
      <KPICard
        label={l ? "Avg Horas/WR" : "Avg Hours/WR"}
        value={`${kpis.avg_hours.toFixed(1)} hrs`}
        accent="#f97316"
      />
    </div>
  );
}