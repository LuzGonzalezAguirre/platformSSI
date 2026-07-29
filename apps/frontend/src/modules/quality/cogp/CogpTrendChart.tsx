import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CogpWeekPoint } from "../services/cogp.service";

interface CogpTrendChartProps {
  points: CogpWeekPoint[];
  color?: string;
}

const THRESHOLD = 2;

export default function CogpTrendChart({ points, color = "#3b82f6" }: CogpTrendChartProps) {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{ idx: number } | null>(null);

  if (points.length === 0) {
    return (
      <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem", padding: "1rem" }}>
        {t("cogpDashboard.noData")}
      </div>
    );
  }

  const values = points.map(p => (p.cogp_pct !== null ? parseFloat(p.cogp_pct) : 0));
  const maxVal = Math.max(...values, THRESHOLD * 1.5, 1);

  const W = 480; const H = 180;
  const padL = 30; const padR = 16; const padT = 16; const padB = 26;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = points.length;

  const toX = (i: number) => (n === 1 ? padL + chartW / 2 : padL + (i / (n - 1)) * chartW);
  const toY = (v: number) => padT + chartH * (1 - v / maxVal);

  const linePoints = points.map((_, i) => `${toX(i).toFixed(1)},${toY(values[i]).toFixed(1)}`).join(" ");
  const thresholdY = toY(THRESHOLD);
  const weekLabel = t("cogpDashboard.week");

  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = padT + chartH * (1 - pct);
          return (
            <g key={pct}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.5} />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">
                {(maxVal * pct).toFixed(1)}%
              </text>
            </g>
          );
        })}

        <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />

        <line x1={padL} x2={W - padR} y1={thresholdY} y2={thresholdY} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - padR} y={thresholdY - 3} textAnchor="end" fontSize={8} fontWeight={700} fill="#ef4444">
          {THRESHOLD}% {t("cogpDashboard.target")}
        </text>

        <polyline points={linePoints} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />

        {points.map((p, i) => {
          const v = values[i];
          const isHov = tooltip?.idx === i;
          const dotColor = v <= THRESHOLD ? "#10b981" : "#ef4444";
          return (
            <circle
              key={`${p.iso_year}-${p.iso_week}`}
              cx={toX(i)} cy={toY(v)}
              r={isHov ? 5 : 3.5}
              fill={dotColor}
              stroke="var(--color-surface)" strokeWidth={isHov ? 2 : 1}
              onMouseEnter={() => setTooltip({ idx: i })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {points.map((p, i) => (
          <text
            key={`lbl-${p.iso_year}-${p.iso_week}`}
            x={toX(i)} y={H - 6}
            textAnchor="middle" fontSize={7.5} fill="var(--color-text-secondary)"
          >
            {weekLabel}{p.iso_week}
          </text>
        ))}
      </svg>

      {tooltip && (
        <div style={{
          position: "absolute",
          left: `${(toX(tooltip.idx) / W) * 100}%`,
          top: "0.25rem",
          transform: "translate(-50%, 0)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px", padding: "0.4rem 0.6rem",
          fontSize: "0.72rem", color: "var(--color-text-primary)",
          pointerEvents: "none", zIndex: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 700 }}>
            {weekLabel}{points[tooltip.idx].iso_week} · {points[tooltip.idx].iso_year}
          </div>
          <div>
            COGP:{" "}
            <strong style={{ color: values[tooltip.idx] <= THRESHOLD ? "#10b981" : "#ef4444" }}>
              {values[tooltip.idx].toFixed(2)}%
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}