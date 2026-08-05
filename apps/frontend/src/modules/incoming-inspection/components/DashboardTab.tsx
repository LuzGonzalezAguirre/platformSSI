import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { useIncomingDashboard } from "../hooks/useIncomingInspection";
import type { IncomingInspectionFilters } from "../types";
import { acceptanceColor, bigNumber, card, cardTitle, COLORS, LABEL, slaColor } from "./ui";
import DailyTrendChart from "./charts/DailyTrendChart";
import CycleTimeHistogram from "./charts/CycleTimeHistogram";
import TopRejectedPartsChart from "./charts/TopRejectedPartsChart";

interface Props { filters: IncomingInspectionFilters; }

const Donut: React.FC<{ pct: number; color: string }> = ({ pct, color }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={78} height={78} viewBox="0 0 78 78">
      <circle cx={39} cy={39} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={9} />
      <circle
        cx={39} cy={39} r={radius} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
        strokeLinecap="round" transform="rotate(-90 39 39)"
      />
      <text x={39} y={43} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--color-text-primary)">
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
};

const Spinner = () => (
  <RefreshCw size={16} style={{ animation: "iiSpin 1s linear infinite", color: "var(--color-text-secondary)" }} />
);

const DashboardTab: React.FC<Props> = ({ filters }) => {
  const { t } = useTranslation();
  const { data, isFetching, isError } = useIncomingDashboard(filters);

  if (isError) {
    return (
      <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: `1px solid ${COLORS.bad}`, borderRadius: "8px", color: COLORS.bad, fontSize: "0.85rem" }}>
        {t("incomingInspection.detail.error")}
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: "2rem", textAlign: "center" }}><Spinner /></div>;
  }

  const { kpis } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", opacity: isFetching ? 0.65 : 1, transition: "opacity 120ms" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.kpis.lotsInspected")}</div>
          <div style={bigNumber}>{kpis.lots_inspected.total}</div>
          <div style={{ fontSize: "0.72rem", color: LABEL, marginTop: "0.35rem" }}>
            {kpis.lots_inspected.by_operation.map(row => `Op ${row.operation_no}: ${row.count}`).join(" · ")}
          </div>
        </div>

        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={cardTitle}>{t("incomingInspection.kpis.acceptanceRate")}</div>
            <div style={{ fontSize: "0.75rem", color: LABEL }}>
              {t("incomingInspection.kpis.accepted")}: {kpis.acceptance_rate.accepted}
              <br />
              {t("incomingInspection.kpis.rejected")}: {kpis.acceptance_rate.rejected}
            </div>
          </div>
          <Donut pct={kpis.acceptance_rate.acceptance_rate} color={acceptanceColor(kpis.acceptance_rate.acceptance_rate)} />
        </div>

        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={cardTitle}>{t("incomingInspection.kpis.slaCompliance")}</div>
            <div style={{ fontSize: "0.75rem", color: LABEL }}>
              {t("incomingInspection.kpis.onTime")}: {kpis.sla_compliance.on_time} · {t("incomingInspection.kpis.late")}: {kpis.sla_compliance.late}
              <br />
              {t("incomingInspection.kpis.threshold")}: {kpis.sla_compliance.threshold_hours}h
            </div>
          </div>
          <Donut pct={kpis.sla_compliance.compliance_rate} color={slaColor(kpis.sla_compliance.compliance_rate)} />
        </div>

        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.kpis.operationCounts")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {kpis.operation_counts.map(row => (
              <div key={row.operation_key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                <span style={{ color: LABEL }}>{row.operation_name}</span>
                <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{row.lot_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>{t("incomingInspection.dashboard.dailyTrend")}</div>
        <DailyTrendChart data={data.daily_trend} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1rem" }}>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.dashboard.cycleTime")}</div>
          <CycleTimeHistogram data={data.cycle_time_histogram} />
        </div>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.dashboard.topRejected")}</div>
          <TopRejectedPartsChart data={data.top_rejected_parts} />
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;