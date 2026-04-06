import { useState, useEffect } from "react";
import { OpsReportService } from "./ops-report.service";
import { WeeklyTable, ViewMode } from "./types";

interface Props {
  date: string;
  bu: string;
  mode: ViewMode;
  lang: "es" | "en";
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
interface BarChartProps {
  labels: string[];
  series: { label: string; color: string; values: number[] }[];
  title: string;
}

function BarChart({ labels, series, title }: BarChartProps) {
  const padL = 48, padR = 16, padT = 32, padB = 40;
  const w = 420, h = 220;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const allVals = series.flatMap(s => s.values).filter(v => v > 0);
  const maxVal  = allVals.length > 0 ? Math.max(...allVals) * 1.25 : 100;
  const groupW  = chartW / Math.max(labels.length, 1);
  const barW    = Math.min((groupW / series.length) * 0.7, 28);
  const gap     = barW * 0.2;
  const yTicks  = 4;

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = (maxVal / yTicks) * (yTicks - i);
          const y   = padT + (i / yTicks) * chartH;
          return (
            <g key={i}>
              <line x1={padL} x2={padL + chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.5} />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--color-text-tertiary)">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {labels.map((label, gi) => {
          const groupX  = padL + gi * groupW + groupW / 2;
          const totalW  = series.length * (barW + gap) - gap;
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const val  = s.values[gi] ?? 0;
                const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
                const x    = groupX - totalW / 2 + si * (barW + gap);
                const y    = padT + chartH - barH;
                return (
                  <g key={si}>
                    <rect x={x} y={y} width={barW} height={Math.max(barH, 0)} fill={s.color} rx={2} opacity={0.9} />
                    {val > 0 && barH > 16 && (
                      <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">
                        {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={groupX} y={padT + chartH + 14} textAnchor="middle" fontSize={9} fill="var(--color-text-secondary)">
                {label}
              </text>
            </g>
          );
        })}

        <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
      <div style={legendStyle}>
        {series.map((s, i) => (
          <div key={i} style={legendItemStyle}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Line Chart ────────────────────────────────────────────────────────────────
interface LineChartProps {
  labels: string[];
  series: { label: string; color: string; values: (number | null)[]; dash?: boolean }[];
  title: string;
  goalLine?: number;
  goalLabel?: string;
  isPercent?: boolean;
}

function LineChart({ labels, series, title, goalLine, goalLabel, isPercent }: LineChartProps) {
  const padL = 48, padR = 16, padT = 32, padB = 40;
  const w = 420, h = 220;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const allVals = series.flatMap(s => s.values).filter((v): v is number => v !== null && v > 0);
  const maxRaw  = allVals.length > 0 ? Math.max(...allVals) : (isPercent ? 100 : 10);
  const maxVal  = goalLine ? Math.max(maxRaw * 1.1, goalLine * 1.2) : maxRaw * 1.2;
  const xStep   = labels.length > 1 ? chartW / (labels.length - 1) : chartW;
  const yTicks  = 4;

  function toY(val: number) { return padT + chartH - (val / maxVal) * chartH; }
  function toX(i: number)   { return padL + i * xStep; }

  function makePath(values: (number | null)[]): string {
    let path = "";
    values.forEach((val, i) => {
      if (val === null) return;
      const x = toX(i), y = toY(val);
      path += path === "" ? `M${x},${y}` : `L${x},${y}`;
    });
    return path;
  }

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = (maxVal / yTicks) * (yTicks - i);
          const y   = padT + (i / yTicks) * chartH;
          return (
            <g key={i}>
              <line x1={padL} x2={padL + chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.5} />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--color-text-tertiary)">
                {isPercent ? `${val.toFixed(0)}%` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {goalLine !== undefined && (
          <g>
            <line x1={padL} x2={padL + chartW} y1={toY(goalLine)} y2={toY(goalLine)}
              stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" />
            <text x={padL + chartW - 2} y={toY(goalLine) - 4} textAnchor="end" fontSize={8} fill="#ef4444">
              {goalLabel ?? `${goalLine}${isPercent ? "%" : ""}`}
            </text>
          </g>
        )}

        {series.map((s, si) => {
          const path = makePath(s.values);
          return (
            <g key={si}>
              {path && <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash ? "5,3" : undefined} />}
              {s.values.map((val, i) => {
                if (val === null) return null;
                return (
                  <g key={i}>
                    <circle cx={toX(i)} cy={toY(val)} r={4} fill={s.color} />
                    <text x={toX(i)} y={toY(val) - 7} textAnchor="middle" fontSize={8} fill={s.color} fontWeight="600">
                      {isPercent ? `${val.toFixed(1)}%` : val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {labels.map((label, i) => (
          <text key={i} x={toX(i)} y={padT + chartH + 14} textAnchor="middle" fontSize={9} fill="var(--color-text-secondary)">
            {label}
          </text>
        ))}

        <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
      <div style={legendStyle}>
        {series.map((s, i) => (
          <div key={i} style={legendItemStyle}>
            <div style={{ width: 18, height: 2, background: s.dash ? "transparent" : s.color, borderTop: s.dash ? `2px dashed ${s.color}` : "none" }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "1rem",
};
const titleStyle: React.CSSProperties = {
  fontSize: "0.8125rem", fontWeight: 700,
  color: "var(--color-text-primary)", marginBottom: "0.5rem",
};
const legendStyle: React.CSSProperties = {
  display: "flex", gap: "1rem", justifyContent: "center", marginTop: "0.25rem",
};
const legendItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.375rem",
  fontSize: "0.75rem", color: "var(--color-text-secondary)",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ProductionCharts({ date, bu, mode, lang }: Props) {
  const [table, setTable]     = useState<WeeklyTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    OpsReportService.getWeeklyTable(date, bu, mode)
      .then(setTable)
      .catch(() => setError(lang === "es" ? "Error cargando gráficas" : "Error loading charts"))
      .finally(() => setLoading(false));
  }, [date, bu, mode, lang]);

  if (loading) return (
    <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
      {lang === "es" ? "Cargando gráficas..." : "Loading charts..."}
    </div>
  );

  if (error) return (
    <div style={{ padding: "1rem", color: "#ef4444", fontSize: "0.875rem" }}>{error}</div>
  );

  if (!table) return null;

  const periods = table.periods;
  const labels  = periods.map(p => lang === "es" ? p.label_es : p.label);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      <BarChart
        title={lang === "es" ? "Producción vs Target" : "Production vs Target"}
        labels={labels}
        series={[
          { label: lang === "es" ? "Producido" : "Produced", color: "#3b82f6", values: periods.map(p => p.is_future ? 0 : p.produced) },
          { label: "Target", color: "#ef4444", values: periods.map(p => p.target) },
        ]}
      />

      <BarChart
        title="WIP Actual vs Goal"
        labels={labels}
        series={[
          { label: "WIP Actual", color: "#3b82f6", values: periods.map(p => p.wip_actual) },
          { label: "WIP Goal",   color: "#f59e0b", values: periods.map(p => p.wip_goal)   },
        ]}
      />

      <LineChart
        title={lang === "es" ? "Producido Acumulado vs Goal" : "Produced Cumulative vs Goal"}
        labels={labels}
        series={[
          { label: lang === "es" ? "Producido" : "Produced", color: "#3b82f6", values: periods.map(p => p.cum_produced) },
          { label: "Goal", color: "#f59e0b", values: periods.map(p => p.cum_target), dash: true },
        ]}
      />

      <LineChart
        title={lang === "es" ? "Scrap COGP% Acumulado" : "Cumulative Scrap COGP%"}
        labels={labels}
        series={[
          { label: "Scrap COGP%", color: "#3b82f6", values: periods.map(p => p.scrap_cogp_cum) },
        ]}
        goalLine={2}
        goalLabel="Goal < 2%"
        isPercent
      />
    </div>
  );
}