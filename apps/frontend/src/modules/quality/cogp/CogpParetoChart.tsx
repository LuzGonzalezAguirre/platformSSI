import { useTranslation } from "react-i18next";
import { CogpParetoBucket } from "../services/cogp.service";

type Metric = "cost" | "pieces";

interface Props {
  bucket: CogpParetoBucket;
  metric: Metric;
  target: number;
}

/** Highlight the leading reasons whose cumulative impact crosses the allowed scrap budget. */
function offenderCount(values: number[], budget: number, isOverTarget: boolean): number {
  if (!isOverTarget) return 0;
  let cumulative = 0;
  for (let i = 0; i < values.length; i++) {
    cumulative += values[i];
    if (cumulative > budget) return i + 1;
  }
  return values.length;
}

export default function CogpParetoChart({ bucket, metric, target }: Props) {
  const { t } = useTranslation();
  const isCost = metric === "cost";
  const items = isCost ? bucket.items : bucket.piece_items;
  const total = isCost ? Number(bucket.total_scrap) : bucket.total_scrap_qty;
  const denominator = isCost ? Number(bucket.total_extended_cost) : bucket.total_produced_qty + bucket.total_scrap_qty;
  const rate = isCost ? bucket.scrap_rate_pct : bucket.piece_rate_pct;
  const rateValue = rate === null ? null : Number(rate);
  const values = items.map(item => isCost ? Number("cost" in item ? item.cost : 0) : Number("quantity" in item ? item.quantity : 0));
  const offenders = offenderCount(values, denominator * target / 100, rateValue !== null && rateValue > target);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.8rem", marginBottom: "0.8rem" }}>
        <span>{isCost ? t("cogpPareto.totalScrap") : t("cogpPareto.totalPieces")}: <strong>{isCost ? `$${total.toFixed(2)}` : total.toLocaleString()}</strong></span>
        <span>{isCost ? t("cogpPareto.scrapRate") : t("cogpPareto.pieceRate")}: <strong style={{ color: rateValue === null ? "var(--color-text-secondary)" : rateValue > target ? "#ef4444" : "#10b981" }}>
          {rateValue === null ? "—" : `${rateValue.toFixed(2)}%`}
        </strong> · {t("cogpDashboard.target")}: {target}%</span>
      </div>
      {items.length === 0 ? (
        <div style={{ color: "var(--color-text-secondary)", padding: "1rem" }}>{t("cogpDashboard.noData")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {items.map((item, index) => {
            const pct = Number(item.pct_of_total);
            const offender = index < offenders;
            return (
              <div key={`${item.reason}-${item.workcenter}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 26%) minmax(80px, 1fr) auto", gap: "0.65rem", alignItems: "center", color: offender ? "#ef4444" : "var(--color-text-primary)" }}>
                <div style={{ overflowWrap: "anywhere", lineHeight: 1.25, fontSize: "0.76rem" }}>
                  <strong>{item.reason}</strong><br />
                  <span style={{ color: "var(--color-text-secondary)", fontSize: "0.68rem" }}>{item.workcenter}</span>
                  {item.actions?.length > 0 && (
                    <div style={{ marginTop: "0.25rem", display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "0.64rem" }}>Acciones:</span>
                      {item.actions.map(action => (
                        <a
                          key={action.item_id}
                          href={action.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--color-primary)", fontSize: "0.66rem", fontWeight: 800, textDecoration: "none" }}
                        >
                          {action.code}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ height: 18, background: "var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: offender ? "#ef4444" : "#3b82f6", minWidth: 2 }} />
                </div>
                <strong style={{ fontSize: "0.72rem", whiteSpace: "nowrap", textAlign: "right" }}>
                  {isCost ? `$${values[index].toFixed(2)}` : values[index].toLocaleString()} · {pct.toFixed(1)}%
                </strong>
              </div>
            );
          })}
        </div>
      )}
      {offenders > 0 && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginBottom: 0 }}>{t("cogpPareto.offenders")}</p>}
    </div>
  );
}
