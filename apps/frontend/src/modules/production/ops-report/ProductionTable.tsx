import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { OpsReportService } from "./ops-report.service";
import { WeeklyTable, TablePeriod, ViewMode } from "./types";

interface Props {
  date: string;
  bu: string;
  mode: ViewMode;
  lang: "es" | "en";
}

function pctColor(pct: number | null, lowerBetter = false): string {
  if (pct === null) return "var(--color-text-secondary)";
  if (lowerBetter) {
    return pct <= 2 ? "#10b981" : pct <= 3 ? "#f59e0b" : "#ef4444";
  }
  return pct >= 100 ? "#10b981" : pct >= 90 ? "#f59e0b" : "#ef4444";
}

function fmt(val: number | null, decimals = 1, suffix = "%"): string {
  if (val === null) return "—";
  return `${val.toFixed(decimals)}${suffix}`;
}

export default function ProductionTable({ date, bu, mode, lang }: Props) {
  const [open, setOpen]       = useState(false);
  const [table, setTable]     = useState<WeeklyTable | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    OpsReportService.getWeeklyTable(date, bu, mode)
      .then(setTable)
      .catch(() => setError(lang === "es" ? "Error cargando tabla" : "Error loading table"))
      .finally(() => setLoading(false));
  }, [open, date, bu, mode, lang]);

  const title = mode === "daily"
    ? (lang === "es" ? "Producción Semanal" : "Production Week")
    : mode === "weekly"
    ? (lang === "es" ? "Producción Mensual" : "Production Month")
    : (lang === "es" ? "Producción Cuatrimestral" : "Production Quarter");

  const s = styles;

  return (
    <div style={s.wrapper}>
      <button style={s.toggle} onClick={() => setOpen((p) => !p)}>
        <span style={s.toggleTitle}>{title} — {bu.toUpperCase()}</span>
        <span style={s.toggleRight}>
          {table && !loading && (
            <span style={s.summary}>
              {table.totals.produced.toLocaleString()} / {table.totals.target.toLocaleString()} pcs
              &nbsp;·&nbsp;
              <span style={{ color: pctColor(table.totals.pct) }}>
                {table.totals.pct.toFixed(1)}%
              </span>
            </span>
          )}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={s.body}>
          {loading ? (
            <div style={s.loading}>{lang === "es" ? "Cargando..." : "Loading..."}</div>
          ) : error ? (
            <div style={s.error}>{error}</div>
          ) : table ? (
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>{lang === "es" ? "Período" : "Period"}</th>
                    <th style={s.th}>{lang === "es" ? "Fecha" : "Date"}</th>
                    <th style={{ ...s.th, textAlign: "right" }}>
                      {lang === "es" ? "Producido" : "Produced"}
                    </th>
                    <th style={{ ...s.th, textAlign: "right" }}>Target</th>
                    <th style={{ ...s.th, textAlign: "center" }}>%</th>
                    <th style={{ ...s.th, textAlign: "right" }}>
                      {lang === "es" ? "Prod. Acum." : "Cum. Produced"}
                    </th>
                    <th style={{ ...s.th, textAlign: "right" }}>
                      {lang === "es" ? "Target Acum." : "Cum. Target"}
                    </th>
                    <th style={{ ...s.th, textAlign: "center" }}>
                      {lang === "es" ? "% Acum." : "Cum. %"}
                    </th>
                    <th style={{ ...s.th, textAlign: "center" }}>
                      Scrap COGP%
                    </th>
                    <th style={{ ...s.th, textAlign: "center" }}>
                      Scrap COGP% {lang === "es" ? "Acum." : "Cum."}
                    </th>
                    <th style={{ ...s.th, textAlign: "right" }}>
                      {lang === "es" ? "Scrap pzs" : "Scrap pcs"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.periods.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        ...(idx % 2 === 0 ? s.trEven : s.trOdd),
                        opacity: row.is_future ? 0.4 : 1,
                      }}
                    >
                      <td style={{ ...s.td, fontWeight: 700 }}>
                        {lang === "es" ? row.label_es : row.label}
                      </td>
                      <td style={{ ...s.td, color: "var(--color-text-secondary)", fontSize: "0.8125rem" }}>
                        {row.date_str}
                      </td>
                      <td style={{ ...s.td, textAlign: "right", fontWeight: 600 }}>
                        {row.is_future ? "—" : row.produced.toLocaleString()}
                      </td>
                      <td style={{ ...s.td, textAlign: "right" }}>
                        {row.target.toLocaleString()}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {row.day_pct !== null ? (
                          <span style={{
                            ...s.pctBadge,
                            background: `${pctColor(row.day_pct)}18`,
                            color: pctColor(row.day_pct),
                          }}>
                            {row.day_pct.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ ...s.td, textAlign: "right", fontWeight: 600 }}>
                        {row.cum_produced !== null ? row.cum_produced.toLocaleString() : "—"}
                      </td>
                      <td style={{ ...s.td, textAlign: "right" }}>
                        {row.cum_target !== null ? row.cum_target.toLocaleString() : "—"}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {row.cum_pct !== null ? (
                          <span style={{
                            ...s.pctBadge,
                            background: `${pctColor(row.cum_pct)}18`,
                            color: pctColor(row.cum_pct),
                          }}>
                            {row.cum_pct.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {row.scrap_cogp_daily !== null ? (
                          <span style={{ color: pctColor(row.scrap_cogp_daily, true), fontWeight: 600 }}>
                            {row.scrap_cogp_daily.toFixed(2)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        {row.scrap_cogp_cum !== null ? (
                          <span style={{ color: pctColor(row.scrap_cogp_cum, true), fontWeight: 600 }}>
                            {row.scrap_cogp_cum.toFixed(2)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ ...s.td, textAlign: "right" }}>
                        {row.scrap_qty !== null ? row.scrap_qty.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={s.totalRow}>
                    <td style={{ ...s.td, fontWeight: 700 }} colSpan={2}>
                      Total
                    </td>
                    <td style={{ ...s.td, textAlign: "right", fontWeight: 700 }}>
                      {table.totals.produced.toLocaleString()}
                    </td>
                    <td style={{ ...s.td, textAlign: "right", fontWeight: 700 }}>
                      {table.totals.target.toLocaleString()}
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <span style={{
                        ...s.pctBadge,
                        background: `${pctColor(table.totals.pct)}18`,
                        color: pctColor(table.totals.pct),
                        fontWeight: 700,
                      }}>
                        {table.totals.pct.toFixed(1)}%
                      </span>
                    </td>
                    <td colSpan={3} />
                    <td colSpan={2} style={{ ...s.td, textAlign: "center" }}>
                      <span style={{
                        color: pctColor(table.totals.scrap_cogp_cum, true),
                        fontWeight: 700,
                      }}>
                        {table.totals.scrap_cogp_cum.toFixed(2)}%
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper:      { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  toggle:       { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.875rem 1.25rem", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const },
  toggleTitle:  { fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-primary)" },
  toggleRight:  { display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--color-text-secondary)" },
  summary:      { fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  body:         { borderTop: "1px solid var(--color-border)" },
  loading:      { padding: "1.5rem", textAlign: "center", color: "var(--color-text-secondary)" },
  error:        { padding: "1rem", color: "#ef4444", fontSize: "0.875rem" },
  tableWrapper: { overflowX: "auto" as const },
  table:        { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.8125rem" },
  th:           { padding: "0.625rem 0.875rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" as const },
  td:           { padding: "0.5rem 0.875rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" as const },
  trEven:       { background: "var(--color-surface)" },
  trOdd:        { background: "var(--color-surface-raised, var(--color-surface))" },
  totalRow:     { background: "var(--color-surface)", borderTop: "2px solid var(--color-border)" },
  pctBadge:     { padding: "0.15rem 0.5rem", borderRadius: "var(--radius-full, 9999px)", fontSize: "0.75rem", fontWeight: 600 },
};