import { useTranslation } from "react-i18next";
import { PM, PmpBuCount, buColor, buKey } from "./types";

interface Props {
  monthTotal: number;
  yearTotal:  number;
  year:       number;
  complete:   number;
  open:       number;
  hold:       number;
  cancelled:  number;
  fleets:     PmpBuCount[];
}

const panel: React.CSSProperties = {
  border:       "1px solid var(--color-border)",
  background:   "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  padding:      "1rem",
};

const label: React.CSSProperties = {
  fontSize:      "0.6875rem",
  fontWeight:    600,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color:         "var(--color-text-secondary)",
};

const num: React.CSSProperties = {
  fontFamily: PM.mono, fontWeight: 600,
  color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums",
};

function Tile({ text, value, hint }: { text: string; value: number; hint: string }) {
  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={label}>{text}</span>
      <span style={{ ...num, fontSize: "1.875rem", lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>{hint}</span>
    </div>
  );
}

export default function PmpKpiSection({
  monthTotal, yearTotal, year, complete, open, hold, cancelled, fleets,
}: Props) {
  const { t } = useTranslation();

  // Los cancelados no cuentan como trabajo pendiente ni como incumplimiento:
  // se excluyen del denominador para que la tasa refleje solo PM vigentes.
  const activeTotal = monthTotal - cancelled;
  const rate        = activeTotal > 0 ? Math.round((complete / activeTotal) * 100) : 0;
  const fleetMax    = Math.max(1, ...fleets.map((f) => f.count));

  const dot = (color: string): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block",
  });

  const counter = (color: string, value: number, text: string) => (
    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={dot(color)} />
      <span style={num}>{value}</span>
      <span style={{ color: "var(--color-text-secondary)" }}>{text}</span>
    </span>
  );

  return (
    <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Tile text={t("pmp.kpis.totalMonth")} value={monthTotal} hint={t("pmp.kpis.byDueDate")} />
        <Tile text={t("pmp.kpis.totalYear", { year })} value={yearTotal} hint={t("pmp.kpis.fullYear")} />
      </div>

      <div style={{ ...panel, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
          <span style={label}>{t("pmp.kpis.monthCompletion")}</span>
          <span style={{ ...num, fontSize: "0.875rem" }}>{rate}%</span>
        </div>

        <div>
          <div style={{
            display: "flex", height: 10, width: "100%", overflow: "hidden",
            borderRadius: 999, background: "var(--color-border)",
          }}>
            <div style={{ height: "100%", background: PM.success, width: `${activeTotal > 0 ? (complete / activeTotal) * 100 : 0}%` }} />
            <div style={{ height: "100%", background: PM.hold,    width: `${activeTotal > 0 ? (hold / activeTotal) * 100 : 0}%` }} />
          </div>
          <div style={{ marginTop: "0.35rem", fontSize: "0.6875rem", color: "var(--color-text-secondary)" }}>
            {t("pmp.kpis.activeBase", { count: activeTotal })}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", flexWrap: "wrap" }}>
          {counter(PM.success, complete, t("pmp.status.complete"))}
          {counter(PM.hold, hold, t("pmp.status.hold"))}
          {counter("var(--color-border)", open, t("pmp.status.open"))}
          {counter("transparent", cancelled, t("pmp.status.cancelled"))}
        </div>
      </div>

      <div style={{ ...panel, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span style={label}>{t("pmp.kpis.byClient")}</span>
        {fleets.length === 0 ? (
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
            {t("pmp.noData")}
          </span>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {fleets.map((f) => (
              <li key={f.bu} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{
                  width: "5.5rem", flexShrink: 0, fontSize: "0.75rem",
                  color: "var(--color-text-secondary)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {t(`pmp.bu.${buKey(f.bu)}`, { defaultValue: f.bu })}
                </span>
                <span style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" }}>
                  <span style={{
                    display: "block", height: "100%", borderRadius: 999,
                    background: buColor(f.bu), width: `${(f.count / fleetMax) * 100}%`,
                  }} />
                </span>
                <span style={{ ...num, width: "2rem", textAlign: "right", fontSize: "0.75rem" }}>{f.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}