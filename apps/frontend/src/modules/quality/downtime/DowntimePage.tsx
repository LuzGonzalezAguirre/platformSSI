import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { DowntimeService, DowntimeLogsResponse,
  DowntimeSummaryRow, DowntimeTrendPoint, DowntimeTrendGranularity,
  DowntimeCustomerRow
 } from "../services/downtime.service";
import { useStandardFilters } from "../../../components/common/useStandardFilters";
import FilterBar from "../../../components/common/FilterBar";

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, topColor }: { label: string; value: string; topColor: string }) {
  return (
    <div style={{
      background: "var(--color-surface)", border: "1px solid var(--color-border)",
      borderTop: `3px solid ${topColor}`, borderRadius: "var(--radius-lg)",
      padding: "0.75rem 1rem",
      display: "flex", flexDirection: "column", gap: "0.3rem",
    }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.1 }}>{value}</span>
    </div>
  );
}

const CUSTOMER_COLORS: Record<string, string> = {
  "Volvo":          "#1e3a5f",
  "Cummins":        "#dc2626",
  "John Deere":     "#16a34a",
  "TULC":           "#f59e0b",
  "Sin clasificar": "#94a3b8",
};

function CustomerKPICard({ row, l }: { row: DowntimeCustomerRow; l: boolean }) {
  return (
    <div style={{
      background: "var(--color-surface)", border: "1px solid var(--color-border)",
      borderTop: `3px solid ${CUSTOMER_COLORS[row.customer] ?? "#94a3b8"}`,
      borderRadius: "var(--radius-lg)", padding: "0.75rem 0.85rem",
      display: "flex", flexDirection: "column", gap: "0.2rem", justifyContent: "center",
    }}>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
        {row.customer === "Sin clasificar" && !l ? "Unclassified" : row.customer}
      </span>
      <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.1 }}>
        {row.total_minutes} min
      </span>
      <span style={{ fontSize: "0.66rem", color: "var(--color-text-tertiary)" }}>
        {row.total_hours.toFixed(2)}h · {row.share_pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ── Trend chart (SVG inline, sin librerías externas) ────────────────────────

const LINE_COLOR = "#1e3a5f";
const TOP_CARD_HEIGHT = 350;
const BOTTOM_CARD_HEIGHT = 300;

function TrendChart({ points, l, granularity }: { points: DowntimeTrendPoint[]; l: boolean; granularity: DowntimeTrendGranularity }) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>
        {l ? "Sin datos" : "No data"}
      </div>
    );
  }

  const W = 700, H = 220;
  const PAD = { top: 16, right: 16, bottom: 28, left: 34 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const n = points.length;
  const rawMax = Math.max(...points.map(p => p.total_hours), 0);
  const yMax = rawMax > 0 ? rawMax * 1.15 : 1;

  const xPos = (i: number) => PAD.left + (n === 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yPos = (v: number) => PAD.top + iH - (v / yMax) * iH;

  const MONTH_NAMES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const isoWeekNumber = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  };

  const pointLabel = (dateStr: string) => {
    if (granularity === "month") {
      const [y, m] = dateStr.split("-");
      const names = l ? MONTH_NAMES_ES : MONTH_NAMES_EN;
      return `${names[Number(m) - 1]} ${y.slice(2)}`;
    }
    const d = new Date(dateStr + "T00:00:00");
    if (granularity === "week") {
      return `${l ? "Sem" : "Week"} ${isoWeekNumber(d)}`;
    }
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const pts = points.map((p, i) => ({ x: xPos(i), y: yPos(p.total_hours), ...p }));
  const linePts = pts.map(p => `${p.x},${p.y}`).join(" ");
  const areaPts = [`${pts[0].x},${PAD.top + iH}`, ...pts.map(p => `${p.x},${p.y}`), `${pts[pts.length - 1].x},${PAD.top + iH}`].join(" ");

  const yTicks = [0, 0.5, 1].map(pct => ({ value: yMax * pct, y: yPos(yMax * pct) }));
  const hovered = hover !== null ? pts[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}>
        {yTicks.map(t => (
          <g key={t.value}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + iW} y2={t.y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={PAD.left - 6} y={t.y + 3} fontSize="9" fill="var(--color-text-tertiary)" textAnchor="end">
              {t.value.toFixed(0)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top + iH} x2={PAD.left + iW} y2={PAD.top + iH} stroke="var(--color-border)" strokeWidth="1" />

        <polygon points={areaPts} fill={LINE_COLOR} opacity="0.08" />
        <polyline points={linePts} fill="none" stroke={LINE_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hovered && (
          <line x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={PAD.top + iH} stroke={LINE_COLOR} strokeWidth="1" strokeDasharray="3,2" opacity="0.4" />
        )}

        {pts.map((p, i) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r={10} fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHover(i)} />
            <circle cx={p.x} cy={p.y} r={hover === i ? 4.5 : 3} fill={hover === i ? "#fff" : LINE_COLOR} stroke={LINE_COLOR} strokeWidth="1.5" />
            <text x={p.x} y={PAD.top + iH + 15} fontSize="9" fill="var(--color-text-tertiary)" textAnchor="middle">
              {pointLabel(p.date)}
            </text>
          </g>
        ))}
      </svg>
      {hovered && (
        <div style={{
          position: "absolute",
          left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`,
          transform: "translate(-50%, -125%)",
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", padding: "0.3rem 0.5rem", fontSize: "10px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{pointLabel(hovered.date)}</div>
          <div style={{ color: LINE_COLOR, fontWeight: 700 }}>{hovered.total_hours.toFixed(2)}h</div>
          <div style={{ color: "var(--color-text-tertiary)" }}>
            {hovered.incident_count} {l ? "incidencias" : "incidents"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pareto por Workcenter ─────────────────────────────────────────────────────

function computeWorkcenterPareto(rows: DowntimeSummaryRow[]) {
  const map = new Map<string, { minutes: number; incidents: number }>();
  for (const r of rows) {
    const cur = map.get(r.workcenter) ?? { minutes: 0, incidents: 0 };
    cur.minutes += r.total_minutes;
    cur.incidents += r.incident_count;
    map.set(r.workcenter, cur);
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v.minutes, 0);
  const sorted = Array.from(map.entries()).sort((a, b) => b[1].minutes - a[1].minutes);

  let cumulative = 0;
  return sorted.map(([workcenter, v]) => {
    const pct = total > 0 ? (v.minutes / total) * 100 : 0;
    cumulative += pct;
    return {
      workcenter,
      minutes: v.minutes,
      incidents: v.incidents,
      pct_of_total: pct,
      cumulative_pct: cumulative,
    };
  });
}

const PARETO_BAR_COLOR = "#ef6461";
const PARETO_LINE_COLOR = "#f59e0b";

function WorkcenterParetoChart({ rows, l }: { rows: DowntimeSummaryRow[]; l: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const pareto = computeWorkcenterPareto(rows);

  if (pareto.length === 0) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>
        {l ? "Sin datos" : "No data"}
      </div>
    );
  }

  const W = 700, H = 220;
  const PAD = { top: 22, right: 34, bottom: 30, left: 30 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const n = pareto.length;

  const maxMinutes = Math.max(...pareto.map((p) => p.minutes), 1);
  const barSlot = iW / n;
  const barW = barSlot * 0.55;

  const xCenter = (i: number) => PAD.left + barSlot * (i + 0.5);
  const yBar = (v: number) => PAD.top + iH - (v / maxMinutes) * iH;
  const yPct = (pct: number) => PAD.top + iH - (pct / 100) * iH;

  const linePts = pareto.map((p, i) => `${xCenter(i)},${yPct(p.cumulative_pct)}`).join(" ");
  const pctTicks = [0, 25, 50, 75, 100];
  const minutesTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxMinutes * f));

  const hovered = hover !== null ? pareto[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}>

        {minutesTicks.map((v) => (
          <g key={`m-${v}`}>
            <line x1={PAD.left} y1={yBar(v)} x2={PAD.left + iW} y2={yBar(v)} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={PAD.left - 6} y={yBar(v) + 3} fontSize="9" fill="var(--color-text-tertiary)" textAnchor="end">{v}</text>
          </g>
        ))}
        {pctTicks.map((p) => (
          <text key={`p-${p}`} x={PAD.left + iW + 6} y={yPct(p) + 3} fontSize="9" fill={PARETO_LINE_COLOR} textAnchor="start">
            {p}%
          </text>
        ))}

        <line x1={PAD.left} y1={PAD.top + iH} x2={PAD.left + iW} y2={PAD.top + iH} stroke="var(--color-border)" strokeWidth="1" />

        {pareto.map((p, i) => {
          const x = xCenter(i) - barW / 2;
          const y = yBar(p.minutes);
          const h = PAD.top + iH - y;
          return (
            <g key={p.workcenter}>
              <rect
                x={x} y={y} width={barW} height={Math.max(h, 1)} rx={2}
                fill={PARETO_BAR_COLOR} opacity={hover === i ? 1 : 0.9}
                onMouseEnter={() => setHover(i)}
                style={{ cursor: "pointer" }}
              />
              <text x={xCenter(i)} y={y - 5} fontSize="10" fontWeight={700} fill="var(--color-text-primary)" textAnchor="middle">
                {p.minutes}
              </text>
              <text
                x={xCenter(i)} y={PAD.top + iH + 13} fontSize="9" fill="var(--color-text-tertiary)" textAnchor="middle"
                style={{ maxWidth: barSlot }}
              >
                {p.workcenter.length > 12 ? `${p.workcenter.slice(0, 11)}…` : p.workcenter}
              </text>
            </g>
          );
        })}

        <polyline points={linePts} fill="none" stroke={PARETO_LINE_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pareto.map((p, i) => (
          <circle
            key={`dot-${p.workcenter}`}
            cx={xCenter(i)} cy={yPct(p.cumulative_pct)}
            r={hover === i ? 5 : 3.5}
            fill={hover === i ? "#fff" : PARETO_LINE_COLOR}
            stroke={PARETO_LINE_COLOR} strokeWidth="2"
            onMouseEnter={() => setHover(i)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </svg>

      {hovered && (
        <div style={{
          position: "absolute",
          left: `${(xCenter(hover!) / W) * 100}%`, top: `${(yPct(hovered.cumulative_pct) / H) * 100}%`,
          transform: "translate(-50%, -130%)",
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", padding: "0.3rem 0.5rem", fontSize: "10px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{hovered.workcenter}</div>
          <div style={{ color: PARETO_BAR_COLOR, fontWeight: 700 }}>{hovered.minutes} min</div>
          <div style={{ color: PARETO_LINE_COLOR, fontWeight: 700 }}>{hovered.cumulative_pct.toFixed(1)}% {l ? "acum." : "cum."}</div>
          <div style={{ color: "var(--color-text-tertiary)" }}>{hovered.incidents} {l ? "incidencias" : "incidents"}</div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DowntimePage() {

  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const l = lang === "es";
  const navigate = useNavigate();

  const { draft, setDraft, applied, apply } = useStandardFilters("yesterday");

  const [data, setData] = useState<DowntimeLogsResponse | null>(null);
  const [summary, setSummary] = useState<DowntimeSummaryRow[] | null>(null);
  const [byCustomer, setByCustomer] = useState<DowntimeCustomerRow[] | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trend, setTrend] = useState<DowntimeTrendPoint[] | null>(null);
  const [trendGranularity, setTrendGranularity] = useState<DowntimeTrendGranularity>("daily");
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!applied.start || !applied.end) return;
    setLoading(true);
    setSummaryLoading(true);
    setError(null);
    try {
      const filters = { bu: applied.bu, workcenter: applied.workcenter, shift: applied.shift };
      const [logsRes, summaryRes] = await Promise.all([
        DowntimeService.getLogs(applied.start, applied.end, filters),
        DowntimeService.getSummary(applied.start, applied.end, filters),
      ]);
      setData(logsRes);
      setSummary(summaryRes.rows);
      setByCustomer(summaryRes.by_customer);
    } catch (e: any) {
      setError(e?.response?.data?.error || (l ? "Error cargando datos" : "Error loading data"));
    } finally {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, [applied.start, applied.end, applied.bu, applied.workcenter, applied.shift, l]);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const res = await DowntimeService.getTrend(trendGranularity, data?.date_to);
      setTrend(res.points);
    } catch (e: any) {
      setTrendError(e?.response?.data?.error || (l ? "Error cargando tendencia" : "Error loading trend"));
    } finally {
      setTrendLoading(false);
    }
  }, [trendGranularity, data?.date_to, l]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTrend(); }, [loadTrend]);

  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.3rem 0.625rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.78rem",
  };
  const th: React.CSSProperties = {
    padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 700,
    color: "var(--color-text-secondary)", textTransform: "uppercase",
    fontSize: "0.7rem", letterSpacing: "0.04em", whiteSpace: "nowrap",
    position: "sticky", top: 0, background: "var(--color-surface)",
  };
  const td: React.CSSProperties = {
    padding: "0.5rem 0.75rem", color: "var(--color-text-primary)",
    borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Downtime
          </h1>
          {data && (
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              {data.date_from === data.date_to ? data.date_from : `${data.date_from} → ${data.date_to}`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <FilterBar draft={draft} setDraft={setDraft} onApply={apply} loading={loading} />
          <button
            style={{ ...btn, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "0.4rem" }}
            onClick={() => navigate("/quality/downtime/settings")}
            title={l ? "Asignación de inspectores" : "Inspector assignment"}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "0.4rem 0.75rem", color: "#b91c1c", fontSize: "0.78rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", alignItems: "stretch" }}>
        <KPICard
          label={l ? "Incidencias" : "Incidents"}
          value={loading ? "…" : String(data?.count ?? 0)}
          topColor="#3b82f6"
        />
        <KPICard
          label={l ? "Horas totales" : "Total hours"}
          value={loading ? "…" : `${Math.round((data?.total_hours ?? 0) * 60)} min = ${(data?.total_hours ?? 0).toFixed(2)}h`}
          topColor="#ef4444"
        />
        {byCustomer?.map((row) => (
          <CustomerKPICard key={row.customer} row={row} l={l} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "0.5rem", alignItems: "start" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.75rem", height: TOP_CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              {l ? "Registros" : "Logs"}
              {data && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> ({data.count})</span>}
            </div>

            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                {l ? "Cargando datos Plex..." : "Loading Plex data..."}
              </div>
            ) : !data || data.results.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>
                {l ? "No hay registros para este rango" : "No records for this range"}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr>
                      <th style={th}>{l ? "Fecha/Hora" : "Date/Time"}</th>
                      <th style={th}>{l ? "Minutos" : "Minutes"}</th>
                      <th style={th}>{l ? "Notas" : "Notes"}</th>
                      <th style={th}>Workcenter</th>
                      <th style={th}>Part No</th>
                      <th style={th}>{l ? "Operación" : "Operation"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((row, idx) => (
                      <tr key={`${row.log_date}-${idx}`}>
                        <td style={td}>
                          {row.log_date
                            ? new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(row.log_date))
                            : ""}
                        </td>
                        <td style={td}>{row.log_hours != null ? Math.round(row.log_hours * 60) : ""}</td>
                        <td style={td}>{row.notes}</td>
                        <td style={td}>{row.workcenter}</td>
                        <td style={td}>{row.part_no}</td>
                        <td style={td}>
                          {row.operation_no}{row.operation_description ? ` — ${row.operation_description}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.75rem", height: BOTTOM_CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              {l ? "Resumen por Workcenter" : "Workcenter Summary"}
              {summary && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> ({summary.length})</span>}
            </div>

            {summaryLoading ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                {l ? "Cargando resumen..." : "Loading summary..."}
              </div>
            ) : !summary || summary.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>
                {l ? "No hay registros para este rango" : "No records for this range"}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr>
                      <th style={th}>{l ? "Fecha" : "Date"}</th>
                      <th style={th}>Workcenter</th>
                      <th style={th}>{l ? "Minutos" : "Minutes"}</th>
                      <th style={th}>{l ? "Incidencias" : "Incidents"}</th>
                      <th style={th}>{l ? "Inspector" : "Inspector"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, idx) => (
                      <tr key={`${row.date}-${row.workcenter}-${idx}`}>
                        <td style={td}>{row.date}</td>
                        <td style={td}>{row.workcenter}</td>
                        <td style={td}>{row.total_minutes}</td>
                        <td style={td}>{row.incident_count}</td>
                        <td style={{ ...td, color: row.inspector_name ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
                          {row.inspector_name || (l ? "— Sin asignar —" : "— Unassigned —")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.875rem", height: TOP_CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {l ? "Tendencia de Downtime" : "Downtime Trend"}
              </div>
              <div style={{ display: "flex", background: "var(--color-bg-secondary, #f1f5f9)", borderRadius: "var(--radius-md)", padding: "2px" }}>
                {(["daily", "week", "month"] as DowntimeTrendGranularity[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setTrendGranularity(g)}
                    style={{
                      border: "none", borderRadius: "calc(var(--radius-md) - 2px)",
                      padding: "0.25rem 0.6rem", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
                      background: trendGranularity === g ? "var(--color-surface)" : "transparent",
                      color: trendGranularity === g ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      boxShadow: trendGranularity === g ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {g === "daily" ? (l ? "Día" : "Day") : g === "week" ? (l ? "Semana" : "Week") : (l ? "Mes" : "Month")}
                  </button>
                ))}
              </div>
            </div>

            {trend && (
  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
    <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
      {l ? "Total" : "Total"}
    </span>
    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: LINE_COLOR }}>
      {trend.reduce((sum, p) => sum + p.total_hours, 0).toFixed(1)}h
    </span>
    <span style={{ fontSize: "0.72rem", color: "var(--color-text-tertiary)" }}>
      {trend.length} {trendGranularity === "daily" ? (l ? "días" : "days") : trendGranularity === "week" ? (l ? "semanas" : "weeks") : (l ? "meses" : "months")}
    </span>
  </div>
)}

            {trendError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "0.4rem 0.75rem", color: "#b91c1c", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
                {trendError}
              </div>
            )}

            {trendLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                {l ? "Cargando tendencia..." : "Loading trend..."}
              </div>
            ) : (
              <TrendChart points={trend ?? []} l={l} granularity={trendGranularity} />
            )}
          </div>

          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.875rem", height: BOTTOM_CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              {l ? "Pareto — Tiempo por Workcenter" : "Pareto — Time by Workcenter"}
            </div>
            {summaryLoading ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                {l ? "Cargando..." : "Loading..."}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <WorkcenterParetoChart rows={summary ?? []} l={l} />
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}