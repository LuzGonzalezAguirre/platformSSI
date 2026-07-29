import { useTranslation } from "react-i18next";
import { CogpParetoBucket } from "../services/cogp.service";

interface CogpParetoChartProps {
  bucket: CogpParetoBucket;
}

const ROW_HEIGHT = 20;
const LABEL_COL_WIDTH = 170;
const VALUE_COL_WIDTH = 110;

export default function CogpParetoChart({ bucket }: CogpParetoChartProps) {
  const { t } = useTranslation();
  const items = bucket.items;

  if (items.length === 0) {
    return (
      <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem", padding: "1rem" }}>
        {t("cogpDashboard.noData")}
      </div>
    );
  }

  //const maxCost = Math.max(...items.map(i => parseFloat(i.cost)), 1);

  const totalScrap = parseFloat(bucket.total_scrap);
  const scrapRate = bucket.scrap_rate_pct !== null ? parseFloat(bucket.scrap_rate_pct) : null;

  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: "0.6rem", fontSize: "0.75rem", color: "var(--color-text-secondary)",
      }}>
        <span>
          {t("cogpPareto.totalScrap")}: <strong style={{ color: "var(--color-text-primary)" }}>
            ${totalScrap.toFixed(2)}
          </strong>
        </span>
        <span>
          {t("cogpPareto.scrapRate")}: <strong style={{
            color: scrapRate !== null && scrapRate <= 2 ? "#10b981" : "#ef4444",
          }}>
            {scrapRate !== null ? `${scrapRate.toFixed(2)}%` : "—"}
          </strong>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {items.map((item, i) => {
          const cost = parseFloat(item.cost);
          const pct = parseFloat(item.pct_of_total);
          const barWidthPct = pct;

          return (
            <div key={`${item.reason}-${item.workcenter}-${i}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: LABEL_COL_WIDTH, flexShrink: 0, textAlign: "left",
                fontSize: "0.68rem", lineHeight: 1.2, color: "var(--color-text-primary)",
              }}>
                <div style={{ fontWeight: 600 }}>{item.reason}</div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: "0.62rem" }}>
                  ({item.workcenter})
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0, height: ROW_HEIGHT, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${barWidthPct}%`,
                  background: "#3b82f6", borderRadius: 3, minWidth: 2,
                }} />
              </div>

              <div style={{
                width: VALUE_COL_WIDTH, flexShrink: 0, textAlign: "left",
                fontSize: "0.68rem", fontWeight: 700, color: "var(--color-text-primary)",
                whiteSpace: "nowrap",
              }}>
                ${cost.toFixed(2)} | {pct.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}