import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DowntimeByMonth, DateRange } from "./types";
import { usePeriodicSeries, ChartPeriod } from "./usePeriodicSeries";
import { MaintenanceService } from "./overview.service";

interface Props {
  data: DowntimeByMonth[];
  lang: string;
  compact?: boolean;
  dayRange: DateRange;
}

// Bucketea por semana/mes sumando total_hours y total_events por razón —
// el endpoint solo devuelve granularidad diaria, y una ventana de 6 meses
// sin agregar produciría ~180 barras ilegibles.
function bucketKey(dateStr: string, mode: "week" | "month"): string {
  const date = new Date(dateStr + "T12:00:00");
  if (mode === "month") return dateStr.slice(0, 7);
  const day  = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon  = new Date(date.getFullYear(), date.getMonth(), diff);
  return mon.toISOString().split("T")[0];
}

function bucketData(data: DowntimeByMonth[], mode: "week" | "month"): DowntimeByMonth[] {
  const buckets = new Map<string, Map<string, { total_events: number; total_hours: number }>>();
  for (const row of data) {
    const key = bucketKey(row.date, mode);
    if (!buckets.has(key)) buckets.set(key, new Map());
    const reasonMap = buckets.get(key)!;
    const cur = reasonMap.get(row.reason) ?? { total_events: 0, total_hours: 0 };
    cur.total_events += row.total_events;
    cur.total_hours  += row.total_hours;
    reasonMap.set(row.reason, cur);
  }
  const result: DowntimeByMonth[] = [];
  for (const [date, reasonMap] of buckets) {
    for (const [reason, agg] of reasonMap) {
      result.push({ date, reason, ...agg });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

interface TooltipInfo {
  x: number;
  y: number;
  date: string;
  entries: { reason: string; hours: number; color: string }[];
  total: number;
}

const PALETTE = ["#ef4444","#3b82f6","#f59e0b","#8b5cf6","#10b981","#f97316","#06b6d4","#ec4899","#84cc16","#6b7280"];
const REASON_COLORS: Record<string, string> = {};

function getColor(reason: string): string {
  if (!REASON_COLORS[reason]) {
    const idx = Object.keys(REASON_COLORS).length % PALETTE.length;
    REASON_COLORS[reason] = PALETTE[idx];
  }
  return REASON_COLORS[reason];
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLabel(d: string, period: ChartPeriod): string {
  if (period === "month") {
    const [y, m] = d.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return formatDate(d);
}

export default function DowntimeStackedChart({ data: dayData, lang, compact = false, dayRange }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [period,  setPeriod]  = useState<ChartPeriod>("day");

  const { data: periodData, loading: periodLoading } = usePeriodicSeries(
    period, dayRange, dayData,
    (start, end) => MaintenanceService.getDowntimeByMonth(start, end).then((r) => r.data)
  );

  const data = period === "day" ? periodData : bucketData(periodData, period);

  if (data.length === 0) return (
    <div style={card}>
      <div style={sectionTitle}>
        {lang === "es" ? "Desglose de Paros por Razón" : "Downtime Breakdown by Reason"}
      </div>
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
        {periodLoading
          ? (lang === "es" ? "Cargando..." : "Loading...")
          : (lang === "es" ? "Sin registros en el rango seleccionado" : "No records in selected range")}
      </div>
    </div>
  );

  const dates   = [...new Set(data.map((d) => d.date))].sort();
  const reasons = [...new Set(data.map((d) => d.reason))];

  const byDate: Record<string, Record<string, number>> = {};
  for (const d of dates) byDate[d] = {};
  for (const row of data) {
    byDate[row.date][row.reason] = (byDate[row.date][row.reason] ?? 0) + row.total_hours;
  }

  const totals   = dates.map((d) => Object.values(byDate[d]).reduce((a, b) => a + b, 0));
  const maxTotal = Math.max(...totals, 0.1);

  const padL   = compact ? 32 : 48;
  const padR   = 16;
  const padT   = compact ? 10 : 20;
  const padB   = compact ? 26 : 40;
  const w      = 760;
  const h      = compact ? 190 : 260;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const axisFontSize  = compact ? 7 : 9;
  const labelFontSize = compact ? 7 : 8;
  const totalFontSize = compact ? 6 : 7;

  const barW      = Math.max(4, Math.min(40, (chartW / dates.length) * 0.7));
  const groupW    = chartW / dates.length;
  const labelStep = Math.max(1, Math.ceil(dates.length / 8));

  function toY(v: number) { return padT + chartH - (v / (maxTotal * 1.15)) * chartH; }
  function toH(v: number) { return (v / (maxTotal * 1.15)) * chartH; }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>
          {lang === "es" ? "Desglose de Paros por Razón" : "Downtime Breakdown by Reason"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {(["day", "week", "month"] as ChartPeriod[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "0.25rem 0.625rem", fontSize: "0.72rem", fontWeight: 600, border: "none", cursor: "pointer",
                background: period === p ? "var(--color-border)" : "transparent",
                color: period === p ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              }}>
                {p === "day" ? (lang === "es" ? "Día" : "Day") : p === "week" ? (lang === "es" ? "Semana" : "Week") : (lang === "es" ? "Mes" : "Month")}
              </button>
            ))}
          </div>
          {reasons.map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: compact ? "0.65rem" : "0.75rem", color: "var(--color-text-secondary)" }}>
              <div style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, borderRadius: 2, background: getColor(r), flexShrink: 0 }} />
              {r}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        {periodLoading && (
          <div style={spinnerOverlay}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--color-text-secondary)" }} />
          </div>
        )}
        <svg
          width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
          style={{ display: "block" }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Y grid */}
          {Array.from({ length: 6 }, (_, i) => {
            const val = (maxTotal * 1.15 * i) / 5;
            const y   = toY(val);
            return (
              <g key={i}>
                <line x1={padL} x2={padL + chartW} y1={y} y2={y}
                  stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3,3" />
                <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={axisFontSize} fill="var(--color-text-secondary)">
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Stacked bars */}
          {dates.map((date, di) => {
            const cx       = padL + di * groupW + groupW / 2;
            const dateData = byDate[date];
            let cumulative = 0;

            // Preparar entries para tooltip
            const entries = reasons
              .filter((r) => (dateData[r] ?? 0) > 0)
              .map((r) => ({ reason: r, hours: dateData[r], color: getColor(r) }))
              .sort((a, b) => b.hours - a.hours);

            return (
              <g key={date}>
                {reasons.map((reason) => {
                  const val = dateData[reason] ?? 0;
                  if (val === 0) return null;
                  const bh  = toH(val);
                  const y   = toY(cumulative + val);
                  cumulative += val;
                  return (
                    <rect
                      key={reason}
                      x={cx - barW / 2} y={y}
                      width={barW} height={Math.max(bh, 0)}
                      fill={getColor(reason)} opacity={0.88}
                      style={{ cursor: "crosshair" }}
                    />
                  );
                })}

                {/* Zona hover invisible sobre toda la barra */}
                <rect
                  x={cx - groupW / 2} y={padT}
                  width={groupW} height={chartH}
                  fill="transparent"
                  style={{ cursor: "crosshair" }}
                  onMouseEnter={() => setTooltip({
                    x: cx,
                    y: toY(totals[di]),
                    date,
                    entries,
                    total: totals[di],
                  })}
                />

                {/* Total encima */}
                {totals[di] > 0 && (
                  <text x={cx} y={toY(totals[di]) - 3} textAnchor="middle"
                    fontSize={totalFontSize} fontWeight="700" fill="var(--color-text-primary)">
                    {totals[di].toFixed(1)}
                  </text>
                )}

                {/* X label */}
                {di % labelStep === 0 && !compact && (
                  <text x={cx} y={padT + chartH + 16} textAnchor="middle"
                    fontSize={labelFontSize} fill="var(--color-text-secondary)">
                    {formatLabel(date, period)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Axes */}
          <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
          <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        </svg>

        {/* Tooltip absoluto sobre el SVG */}
        {tooltip && (
          <div style={{
            position: "absolute",
            top: 0,
            left: `calc(${(tooltip.x / w) * 100}%)`,
            transform: "translateX(-50%)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "0.625rem 0.875rem",
            fontSize: "0.75rem",
            pointerEvents: "none",
            zIndex: 20,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            minWidth: 160,
          }}>
            <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.375rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.25rem" }}>
              {formatLabel(tooltip.date, period)}
            </div>
            {tooltip.entries.map((e) => (
              <div key={e.reason} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                  <span style={{ color: "var(--color-text-secondary)" }}>{e.reason}</span>
                </div>
                <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {e.hours.toFixed(2)}h
                </span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--color-border)", marginTop: "0.25rem", paddingTop: "0.25rem", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>Total</span>
              <span style={{ fontWeight: 800, color: "var(--color-text-primary)" }}>{tooltip.total.toFixed(2)}h</span>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)", padding: "1.25rem",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0,
};
const spinnerOverlay: React.CSSProperties = {
  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
  background: "color-mix(in srgb, var(--color-surface) 70%, transparent)", zIndex: 5,
};