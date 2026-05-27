import type { KpiData } from "../api/chairApi";

interface Props {
  data: KpiData | undefined;
  loading: boolean;
}

function Card({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "16px 20px",
        borderLeft: `4px solid ${color}`,
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
        minWidth: 160,
        flex: 1,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 500 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: "#1a1a2e" }}>
        {value}
      </p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#999" }}>{sub}</p>}
    </div>
  );
}

export function KPICards({ data, loading }: Props) {
  if (loading) {
    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 160,
              height: 90,
              background: "#f0f0f0",
              borderRadius: 10,
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Card label="Descansos hoy" value={data.today_breaks} color="#0070C0" />
      <Card label="Descansos en período" value={data.total_breaks} color="#0070C0" />
      <Card
        label="Duración promedio"
        value={`${data.avg_duration_min} min`}
        color="#6366f1"
      />
      <Card
        label="Activos ahora"
        value={data.active_now}
        sub="en descanso"
        color="#FFAA00"
      />
      <Card
        label="Automáticos"
        value={`${data.auto_pct}%`}
        sub={`Manual: ${data.manual_pct}%`}
        color="#00B050"
      />
      <Card
        label="Cumplimiento límite"
        value={`${data.compliance_pct}%`}
        sub="empleados dentro del límite"
        color={data.compliance_pct >= 90 ? "#00B050" : "#e74c3c"}
      />
    </div>
  );
}
