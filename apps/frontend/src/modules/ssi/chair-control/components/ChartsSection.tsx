import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import type { DailyChartPoint, TurnoDistPoint } from "../api/chairApi";

interface Props {
  dailyData: DailyChartPoint[];
  turnoData: TurnoDistPoint[];
  loadingDaily: boolean;
  loadingTurno: boolean;
}

const TURNO_COLORS: Record<string, string> = {
  A: "#0070C0",
  B: "#00B050",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "16px 20px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
        flex: 1,
        minWidth: 280,
      }}
    >
      <h3 style={{ margin: "0 0 14px", fontSize: 14, color: "#333", fontWeight: 600 }}>{title}</h3>
      {children}
    </div>
  );
}

export function ChartsSection({ dailyData, turnoData, loadingDaily, loadingTurno }: Props) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* Bar chart: descansos por día */}
      <ChartCard title="Descansos por día">
        {loadingDaily ? (
          <div style={loadingBox} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="break_date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number) => [v, "Descansos"]}
                labelFormatter={(l) => `Fecha: ${l}`}
              />
              <Bar dataKey="total_breaks" fill="#0070C0" radius={[3, 3, 0, 0]} name="Descansos" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Pie chart: distribución por turno */}
      <ChartCard title="Distribución por turno">
        {loadingTurno ? (
          <div style={loadingBox} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={turnoData}
                dataKey="total"
                nameKey="turno"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ turno, percent }) => `Turno ${turno}: ${(percent * 100).toFixed(1)}%`}
                labelLine={false}
              >
                {turnoData.map((entry) => (
                  <Cell
                    key={entry.turno}
                    fill={TURNO_COLORS[entry.turno] || "#6366f1"}
                  />
                ))}
              </Pie>
              <Legend formatter={(v) => `Turno ${v}`} />
              <Tooltip formatter={(v: number) => [v, "Descansos"]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Line chart: tendencia duración promedio */}
      <ChartCard title="Tendencia duración promedio (min)">
        {loadingDaily ? (
          <div style={loadingBox} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="break_date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number) => [`${v} min`, "Promedio"]}
                labelFormatter={(l) => `Fecha: ${l}`}
              />
              <Line
                type="monotone"
                dataKey="avg_duration"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Promedio"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

const loadingBox: React.CSSProperties = {
  height: 220,
  background: "#f5f5f5",
  borderRadius: 8,
  animation: "pulse 1.4s ease-in-out infinite",
};
