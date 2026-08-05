import React from "react";
import { useTranslation } from "react-i18next";
import type { CycleTimeHistogram as Histogram } from "../../types";
import { AXIS, COLORS, LABEL } from "../ui";

const W = 420, H = 250, PAD_L = 38, PAD_R = 14, PAD_T = 14, PAD_B = 42;

interface Props { data: Histogram; }

const CycleTimeHistogram: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();

  if (!data.total) {
    return <div style={{ fontSize: "0.8rem", color: LABEL }}>{t("incomingInspection.dashboard.noData")}</div>;
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const max = Math.max(...data.buckets.map(b => b.count), 1);
  const step = plotW / data.buckets.length;
  const barW = Math.min(58, step * 0.6);
  const y = (value: number) => PAD_T + plotH - (value / max) * plotH;

  const bucketLabel = (bucket: Histogram["buckets"][number]) =>
    bucket.max_hours === null
      ? t("incomingInspection.dashboard.over", { value: bucket.min_hours })
      : t("incomingInspection.dashboard.range", { from: bucket.min_hours, to: bucket.max_hours });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block" }}>
      {[0, 0.5, 1].map(fraction => {
        const value = Math.round(max * fraction);
        return (
          <g key={fraction}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(value)} y2={y(value)} stroke={AXIS} strokeWidth={1} />
            <text x={PAD_L - 8} y={y(value) + 4} textAnchor="end" fontSize={10} fill={LABEL}>{value}</text>
          </g>
        );
      })}

      {data.buckets.map((bucket, index) => {
        const x = PAD_L + index * step + (step - barW) / 2;
        const pct = data.total ? Math.round((bucket.count / data.total) * 100) : 0;
        return (
          <g key={bucket.key}>
            <title>{`${bucketLabel(bucket)} — ${bucket.count} (${pct}%)`}</title>
            <rect
              x={x} y={y(bucket.count)} width={barW}
              height={plotH - (y(bucket.count) - PAD_T)}
              fill={bucket.breached ? COLORS.bad : COLORS.accent}
              rx={3}
            />
            <text x={x + barW / 2} y={y(bucket.count) - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--color-text-primary)">
              {bucket.count}
            </text>
            <text x={x + barW / 2} y={H - PAD_B + 16} textAnchor="middle" fontSize={9} fill={LABEL}>
              {bucketLabel(bucket)}
            </text>
          </g>
        );
      })}

      <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke={AXIS} strokeWidth={1} />

      <text x={PAD_L} y={H - 8} fontSize={10} fill={LABEL}>
        {`${t("incomingInspection.dashboard.p50")}: ${data.p50 ?? "—"}h · ${t("incomingInspection.dashboard.p90")}: ${data.p90 ?? "—"}h`}
      </text>
    </svg>
  );
};

export default CycleTimeHistogram;