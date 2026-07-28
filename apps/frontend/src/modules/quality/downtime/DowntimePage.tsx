import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DowntimeService, DowntimePreset, DowntimeLogRow, DowntimeLogsResponse, DowntimeTrendPoint, DowntimeTrendGranularity } from "../services/downtime.service";

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
const PRESETS: DowntimePreset[] = ["today", "yesterday", "this_week", "this_month", "custom"];

const presetLabel = (p: DowntimePreset, l: boolean): string => {
  const labels: Record<DowntimePreset, [string, string]> = {
    today:      ["Hoy", "Today"],
    yesterday:  ["Ayer", "Yesterday"],
    this_week:  ["Esta semana", "This week"],
    this_month: ["Este mes", "This month"],
    custom:     ["Rango personalizado", "Custom range"],
  };
  return l ? labels[p][0] : labels[p][1];
};

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

// ── Trend chart (SVG inline, sin librerías externas) ────────────────────────

const LINE_COLOR = "#1e3a5f";

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
    const dayNum = (date.getUTCDay() + 6) % 7; // Lunes = 0
    date.setUTCDate(date.getUTCDate() - dayNum + 3); // jueves de esa semana
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DowntimePage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const l = lang === "es";

  const [preset, setPreset] = useState<DowntimePreset>("custom");
  const [dateFrom, setDateFrom] = useState(yesterdayStr());
  const [dateTo, setDateTo] = useState(yesterdayStr());
  const [data, setData] = useState<DowntimeLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trend, setTrend] = useState<DowntimeTrendPoint[] | null>(null);
  const [trendGranularity, setTrendGranularity] = useState<DowntimeTrendGranularity>("daily");
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  const isCustomIncomplete = preset === "custom" && (!dateFrom || !dateTo);

  const load = useCallback(async () => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    try {
      const res = await DowntimeService.getLogs(preset, dateFrom, dateTo);
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.error || (l ? "Error cargando datos" : "Error loading data"));
    } finally {
      setLoading(false);
    }
  }, [preset, dateFrom, dateTo, isCustomIncomplete, l]);

  // El trend siempre corre "hasta el último día consultado" en la tabla —
  // usa data.date_to como ancla en vez de un rango fijo a hoy.
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

  const inp: React.CSSProperties = {
    padding: "0.3rem 0.5rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", fontSize: "0.78rem",
  };
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

  const avgHoursPerIncident = data && data.count > 0 ? data.total_hours / data.count : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

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
          <select value={preset} style={inp} onChange={(e) => setPreset(e.target.value as DowntimePreset)}>
            {PRESETS.map((p) => (
              <option key={p} value={p}>{presetLabel(p, l)}</option>
            ))}
          </select>
          {preset === "custom" && (
            <>
              <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>{l ? "Desde:" : "From:"}</span>
              <input type="date" value={dateFrom} max={dateTo || todayStr()} style={inp} onChange={(e) => setDateFrom(e.target.value)} />
              <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>{l ? "Hasta:" : "To:"}</span>
              <input type="date" value={dateTo} max={todayStr()} style={inp} onChange={(e) => setDateTo(e.target.value)} />
            </>
          )}
          <button style={btn} onClick={load} disabled={loading || isCustomIncomplete}>
            {loading ? (l ? "Cargando..." : "Loading...") : (l ? "Cargar" : "Load")}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "0.4rem 0.75rem", color: "#b91c1c", fontSize: "0.78rem" }}>
          {error}
        </div>
      )}

      {/* KPIs del rango seleccionado */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
        <KPICard
          label={l ? "Incidencias" : "Incidents"}
          value={loading ? "…" : String(data?.count ?? 0)}
          topColor="#3b82f6"
        />
        <KPICard
          label={l ? "Horas totales" : "Total hours"}
          value={loading ? "…" : `${(data?.total_hours ?? 0).toFixed(2)}h`}
          topColor="#ef4444"
        />
        <KPICard
          label={l ? "Promedio por incidencia" : "Avg per incident"}
          value={loading ? "…" : `${avgHoursPerIncident.toFixed(2)}h`}
          topColor="#10b981"
        />
      </div>

      {/* Tabla + Tendencia lado a lado, para que todo quepa en una sola vista */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "0.5rem", alignItems: "start" }}>

      {/* Tabla */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.75rem" }}>
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
          <div style={{ maxHeight: 380, overflowY: "auto", overflowX: "auto" }}>
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

      {/* Tendencia — hasta el último día consultado en la tabla */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.875rem" }}>
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
              {" · "}{trend[0]?.date} → {trend[trend.length - 1]?.date}
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

      </div>
    </div>
  );
}