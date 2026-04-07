import { useState } from "react";
import { DowntimeByMonth } from "./types";

interface Props {
  data: DowntimeByMonth[];
  lang: string;
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

export default function DowntimeStackedChart({ data, lang }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  if (data.length === 0) return null;

  const dates   = [...new Set(data.map((d) => d.date))].sort();
  const reasons = [...new Set(data.map((d) => d.reason))];

  const byDate: Record<string, Record<string, number>> = {};
  for (const d of dates) byDate[d] = {};
  for (const row of data) {
    byDate[row.date][row.reason] = (byDate[row.date][row.reason] ?? 0) + row.total_hours;
  }

  const totals   = dates.map((d) => Object.values(byDate[d]).reduce((a, b) => a + b, 0));
  const maxTotal = Math.max(...totals, 0.1);

  const padL   = 48;
  const padR   = 16;
  const padT   = 20;
  const padB   = 40;
  const w      = 760;
  const h      = 260;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end" }}>
          {reasons.map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: getColor(r), flexShrink: 0 }} />
              {r}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          width="100%" viewBox={`0 0 ${w} ${h}`}
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
                <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--color-text-secondary)">
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
                    fontSize={7} fontWeight="700" fill="var(--color-text-primary)">
                    {totals[di].toFixed(1)}
                  </text>
                )}

                {/* X label */}
                {di % labelStep === 0 && (
                  <text x={cx} y={padT + chartH + 16} textAnchor="middle"
                    fontSize={8} fill="var(--color-text-secondary)">
                    {formatDate(date)}
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
              {formatDate(tooltip.date)}
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