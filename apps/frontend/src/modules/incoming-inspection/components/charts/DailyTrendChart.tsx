import React from "react";
import { useTranslation } from "react-i18next";
import type { DailyTrendPoint } from "../../types";
import { AXIS, COLORS, LABEL } from "../ui";

const W = 720, H = 250, PAD_L = 42, PAD_R = 14, PAD_T = 14, PAD_B = 40;

interface Props { data: DailyTrendPoint[]; }

const DailyTrendChart: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();

  if (!data.length) {
    return <div style={{ fontSize: "0.8rem", color: LABEL }}>{t("incomingInspection.dashboard.noData")}</div>;
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const max = Math.max(...data.map(d => d.inspected), 1);
  const step = plotW / data.length;
  const barW = Math.max(2, Math.min(38, step * 0.62));
  const labelEvery = Math.ceil(data.length / 10);

  const y = (value: number) => PAD_T + plotH - (value / max) * plotH;
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block" }}>
      {gridValues.map(value => (
        <g key={value}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(value)} y2={y(value)} stroke={AXIS} strokeWidth={1} />
          <text x={PAD_L - 8} y={y(value) + 4} textAnchor="end" fontSize={10} fill={LABEL}>{value}</text>
        </g>
      ))}

      {data.map((point, index) => {
        const x = PAD_L + index * step + (step - barW) / 2;
        const acceptedH = (point.accepted / max) * plotH;
        const rejectedH = (point.rejected / max) * plotH;
        const label = point.date.slice(5).replace("-", "/");
        return (
          <g key={point.date}>
            <title>
              {`${point.date} — ${t("incomingInspection.dashboard.inspected")}: ${point.inspected} · ${t("incomingInspection.dashboard.rejected")}: ${point.rejected} (${point.rejection_rate}%)`}
            </title>
            <rect x={x} y={y(point.rejected)} width={barW} height={rejectedH} fill={COLORS.bad} rx={2} />
            <rect x={x} y={y(point.inspected)} width={barW} height={acceptedH} fill={COLORS.good} rx={2} />
            {index % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - PAD_B + 16} textAnchor="middle" fontSize={9} fill={LABEL}>
                {label}
              </text>
            )}
          </g>
        );
      })}

      <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke={AXIS} strokeWidth={1} />

      <g transform={`translate(${PAD_L}, ${H - 10})`}>
        <rect x={0} y={-8} width={9} height={9} fill={COLORS.good} rx={2} />
        <text x={14} y={0} fontSize={10} fill={LABEL}>{t("incomingInspection.dashboard.accepted")}</text>
        <rect x={90} y={-8} width={9} height={9} fill={COLORS.bad} rx={2} />
        <text x={104} y={0} fontSize={10} fill={LABEL}>{t("incomingInspection.dashboard.rejected")}</text>
      </g>
    </svg>
  );
};

export default DailyTrendChart;