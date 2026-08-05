import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { usePendingBacklog, useUserNames } from "../hooks/useIncomingInspection";
import type { AgingBucket, IncomingInspectionFilters } from "../types";
import { bigNumber, card, cardTitle, COLORS, LABEL } from "./ui";

interface Props { filters: IncomingInspectionFilters; }

const formatDate = (value: string) => new Date(value).toLocaleString();

const PendingTab: React.FC<Props> = ({ filters }) => {
  const { t } = useTranslation();
  const { data, isFetching, isError } = usePendingBacklog(filters);

  const userNos = useMemo(
    () => (data?.results ?? []).map(row => Number(row.change_by)).filter(n => Number.isFinite(n)),
    [data],
  );
  const { data: userNames } = useUserNames(userNos);

  // La conciliación historial vs snapshot sigue calculándose en backend y
  // viaja en el payload — se oculta de la UI a propósito, pero se reporta
  // en consola durante desarrollo para poder auditar el drift.
  useEffect(() => {
    if (import.meta.env.DEV && data?.reconciliation?.status === "drift") {
      console.warn("[incoming-inspection] backlog drift", data.reconciliation);
    }
  }, [data]);

  if (isError) {
    return (
      <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: `1px solid ${COLORS.bad}`, borderRadius: "8px", color: COLORS.bad, fontSize: "0.85rem" }}>
        {t("incomingInspection.detail.error")}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <RefreshCw size={16} style={{ animation: "iiSpin 1s linear infinite", color: "var(--color-text-secondary)" }} />
      </div>
    );
  }

  const { summary } = data;
  const maxBucket = Math.max(...summary.buckets.map(b => b.count), 1);

  const bucketLabel = (bucket: AgingBucket) =>
    bucket.max_hours === null
      ? t("incomingInspection.dashboard.over", { value: bucket.min_hours })
      : t("incomingInspection.dashboard.range", { from: bucket.min_hours, to: bucket.max_hours });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", opacity: isFetching ? 0.65 : 1, transition: "opacity 120ms" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem" }}>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.pending.total")}</div>
          <div style={bigNumber}>{summary.total}</div>
        </div>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.pending.late")}</div>
          <div style={{ ...bigNumber, color: summary.late > 0 ? COLORS.bad : COLORS.good }}>{summary.late}</div>
          <div style={{ fontSize: "0.72rem", color: LABEL, marginTop: "0.3rem" }}>
            {t("incomingInspection.pending.onTime")}: {summary.on_time} · {t("incomingInspection.kpis.threshold")}: {data.threshold_hours}h
          </div>
        </div>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.pending.oldest")}</div>
          <div style={bigNumber}>{summary.oldest_hours != null ? `${summary.oldest_hours}h` : "—"}</div>
        </div>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.pending.avgWaiting")}</div>
          <div style={bigNumber}>{summary.avg_hours != null ? `${summary.avg_hours}h` : "—"}</div>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>{t("incomingInspection.pending.aging")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {summary.buckets.map(bucket => (
            <div key={bucket.key} style={{ display: "grid", gridTemplateColumns: "110px 1fr 44px", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "0.72rem", color: LABEL }}>{bucketLabel(bucket)}</span>
              <div style={{ background: "var(--color-border)", borderRadius: "4px", height: "14px", overflow: "hidden" }}>
                <div style={{ width: `${(bucket.count / maxBucket) * 100}%`, height: "100%", background: bucket.breached ? COLORS.bad : COLORS.accent }} />
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, textAlign: "right", color: "var(--color-text-primary)" }}>{bucket.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ ...cardTitle, marginBottom: "0.6rem" }}>
          {t("incomingInspection.pending.title")}
          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}> ({data.count})</span>
        </div>

        {data.truncated && (
          <div style={{ fontSize: "0.75rem", color: COLORS.warn, marginBottom: "0.6rem" }}>
            {t("incomingInspection.pending.truncated", { count: data.count })}
          </div>
        )}

        {data.results.length === 0 ? (
          <span style={{ fontSize: "0.8rem", color: LABEL }}>{t("incomingInspection.pending.noData")}</span>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)" }}>
                <tr style={{ textAlign: "left", color: LABEL }}>
                  <th style={{ padding: "0.4rem 0.5rem" }}>{t("incomingInspection.pending.columns.serialNo")}</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>{t("incomingInspection.pending.columns.partNo")}</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>{t("incomingInspection.pending.columns.receivedAt")}</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>{t("incomingInspection.pending.columns.waiting")}</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>{t("incomingInspection.pending.columns.location")}</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>{t("incomingInspection.pending.columns.changeBy")}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map(row => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "0.4rem 0.5rem", color: "var(--color-text-primary)", fontWeight: 600 }}>{row.serial_no}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "var(--color-text-primary)" }}>{row.part_no}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: LABEL }}>{formatDate(row.change_date)}</td>
                    <td style={{ padding: "0.4rem 0.5rem", fontWeight: 700, color: row.sla_status === "late" ? COLORS.bad : COLORS.good }}>
                      {row.waiting_hours}h
                    </td>
                    <td style={{ padding: "0.4rem 0.5rem", color: LABEL }}>{row.location ?? "—"}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: LABEL }}>
                      {userNames?.[String(row.change_by)] ?? row.change_by ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingTab;