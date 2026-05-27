import type { AttendanceKpis } from "../api/attendanceApi";

interface Props {
  data: AttendanceKpis | undefined;
  loading: boolean;
}

function Card({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 10,
      padding: "16px 20px",
      borderLeft: `4px solid ${color}`,
      boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
      flex: 1,
      minWidth: 150,
    }}>
      <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 500 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: "#1a1a2e" }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#999" }}>{sub}</p>}
    </div>
  );
}

export function AttendanceKPIs({ data, loading }: Props) {
  if (loading) {
    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: 150, height: 90, background: "#f0f0f0", borderRadius: 10 }} />
        ))}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Card label="Presentes hoy" value={data.present_today} color="#00B050" />
      <Card label="Ausencias" value={data.total_absences} color="#e74c3c" />
      <Card label="Retardos" value={data.total_delays} color="#FFAA00" />
      <Card
        label="Horas regulares"
        value={`${data.total_regular_hours.toFixed(1)} h`}
        sub="acumuladas en período"
        color="#0070C0"
      />
      <Card
        label="Horas extras"
        value={`${data.total_overtime_hours.toFixed(1)} h`}
        sub="8h por registro"
        color="#6366f1"
      />
      <Card
        label="Total horas"
        value={`${data.grand_total_hours.toFixed(1)} h`}
        color="#1a1a2e"
      />
    </div>
  );
}
