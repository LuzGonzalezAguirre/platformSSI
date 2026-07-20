import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { OEETrendPoint, DateRange } from "./types";
import { usePeriodicSeries, ChartPeriod } from "./usePeriodicSeries";
import { MaintenanceService } from "./overview.service";

interface Props { data: OEETrendPoint[]; lang: string; compact?: boolean; dayRange: DateRange; }

type ActiveField  = "oee_pct" | "availability_pct" | "performance_pct" | "quality_pct";
type GroupMode    = "daily" | "weekly" | "monthly";

const FIELD_CONFIG: Record<ActiveField, { label: (lang: string) => string; color: string; target: number }> = {
  oee_pct:          { label: () => "OEE",                                           color: "#1e3a5f", target: 65 },
  availability_pct: { label: (l) => l === "es" ? "Disponibilidad" : "Availability", color: "#10b981", target: 90 },
  performance_pct:  { label: () => "Performance",                                    color: "#f59e0b", target: 85 },
  quality_pct:      { label: (l) => l === "es" ? "Calidad" : "Quality",             color: "#ef4444", target: 98 },
};

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function movingAvg(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.reduce((s, v) => s + v, 0) / window;
  });
}

function groupData(data: OEETrendPoint[], mode: GroupMode): OEETrendPoint[] {
  if (mode === "daily") return data;

  const buckets = new Map<string, { sum: Record<ActiveField, number>; count: number }>();
  const FIELDS: ActiveField[] = ["oee_pct", "availability_pct", "performance_pct", "quality_pct"];

  data.forEach((d) => {
    const date = new Date(d.date + "T12:00:00");
    let key: string;
    if (mode === "weekly") {
      const day  = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const mon  = new Date(date.setDate(diff));
      key = mon.toISOString().split("T")[0];
    } else {
      key = d.date.slice(0, 7);
    }
    if (!buckets.has(key)) buckets.set(key, { sum: { oee_pct: 0, availability_pct: 0, performance_pct: 0, quality_pct: 0 }, count: 0 });
    const b = buckets.get(key)!;
    FIELDS.forEach((f) => { b.sum[f] += d[f] as number; });
    b.count++;
  });

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, { sum, count }]) => ({
      date,
      oee_pct:          round2(sum.oee_pct / count),
      availability_pct: round2(sum.availability_pct / count),
      performance_pct:  round2(sum.performance_pct / count),
      quality_pct:      round2(sum.quality_pct / count),
    }));
}

function round2(v: number): number { return Math.round(v * 100) / 100; }

interface TooltipData { x: number; y: number; date: string; value: number; }

function LineChart({
  data, field, color, target, height = 260, showYLabel = true, compact = false,
  maWindow = 7, showMA = true, onHover,
}: {
  data: OEETrendPoint[]; field: ActiveField; color: string;
  target: number; height?: number; showYLabel?: boolean; compact?: boolean;
  maWindow?: number; showMA?: boolean;
  onHover?: (t: TooltipData | null) => void;
}) {
  const padL   = showYLabel ? 40 : 8;
  const padR   = 16;
  const padT   = compact ? 8 : 24;
  const padB   = compact ? 16 : 32;
  const w      = 500;
  const h      = height;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const values    = data.map((d) => d[field] as number);
  const maValues  = showMA && !compact ? movingAvg(values, maWindow) : [];
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  function toX(i: number) { return padL + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2); }
  function toY(v: number) { return padT + chartH - Math.min(v, 100) / 100 * chartH; }

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

  const maPath: string = maValues
  .map((v, i): string | null => {
    if (v === null) return null;
    const isFirst = maValues.slice(0, i).every((x) => x === null);
    return `${isFirst ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`;
  })
  .filter((s): s is string => s !== null)
  .join(" ");

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
      style={{ overflow: "visible", display: "block" }} onMouseLeave={() => onHover?.(null)}>
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={padL} x2={padL + chartW} y1={toY(tick)} y2={toY(tick)} stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3,3" />
          {showYLabel && <text x={padL - 6} y={toY(tick) + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">{tick}</text>}
        </g>
      ))}

      <line x1={padL} x2={padL + chartW} y1={toY(target)} y2={toY(target)} stroke={color} strokeWidth={1} strokeDasharray="4,4" opacity={0.4} />
      {!compact && <text x={padL + chartW + 4} y={toY(target) + 3} fontSize={8} fill={color} opacity={0.7}>{target}%</text>}

      {data.length > 1 && (
        <path d={`${path} L${toX(data.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)} L${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)} Z`}
          fill={color} opacity={0.06} />
      )}

      {/* Línea de datos */}
      {data.length > 1 && (
        <path d={path} fill="none" stroke={color} strokeWidth={compact ? 1.5 : 1.5}
          strokeLinejoin="round" strokeLinecap="round" opacity={showMA && !compact ? 0.35 : 0.9} />
      )}

      {/* Promedio móvil */}
      {!compact && showMA && maPath && (
        <path d={maPath} fill="none" stroke={color} strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      )}
      {values.map((v, i) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r={compact ? 2 : 3} fill={color}
          style={{ cursor: onHover ? "crosshair" : "default" }}
          onMouseEnter={() => onHover?.({ x: toX(i), y: toY(v), date: data[i].date, value: v })}
        />
      ))}

      {!compact && data.map((_, i) =>
        i % labelStep === 0 ? (
          <text key={i} x={toX(i)} y={padT + chartH + 14} textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">
            {formatDate(data[i].date)}
          </text>
        ) : null
      )}

      <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
    </svg>
  );
}

export default function OEETrendChart({ data: dayData, lang, compact = false, dayRange }: Props) {
  const [active,  setActive]  = useState<ActiveField>("oee_pct");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [period,  setPeriod]  = useState<ChartPeriod>("day");
  const [showMA,  setShowMA]  = useState(true);

  const { data, loading: periodLoading } = usePeriodicSeries(
    period, dayRange, dayData,
    (start, end) => MaintenanceService.getOEETrend(start, end).then((r) => r.data)
  );

  // El period gobierna ambas cosas: de dónde vienen los datos (day = rango
  // global, week/month = fetch propio de una ventana de 6 semanas/meses, que
  // igual llega a granularidad diaria) Y cómo se agrupan visualmente —
  // groupMode ya no es un control aparte, se deriva directo del period.
  const groupMode: GroupMode = period === "day" ? "daily" : period === "week" ? "weekly" : "monthly";

  const grouped = useMemo(() => groupData(data, groupMode), [data, groupMode]);
  const maWindow = groupMode === "daily" ? 7 : groupMode === "weekly" ? 4 : 3;

  if (data.length === 0) return (
    <div style={card}>
      <div style={sectionTitle}>OEE Trend</div>
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
        {periodLoading
          ? (lang === "es" ? "Cargando..." : "Loading...")
          : (lang === "es" ? "Sin registros de OEE en el rango seleccionado" : "No OEE records in selected range")}
      </div>
    </div>
  );

  const fields     = Object.entries(FIELD_CONFIG) as [ActiveField, typeof FIELD_CONFIG[ActiveField]][];
  const activeCfg  = FIELD_CONFIG[active];
  const latest     = grouped[grouped.length - 1]?.[active] as number ?? 0;
  const meetsTarget = latest >= activeCfg.target;
  const delta       = latest - activeCfg.target;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>OEE Trend</div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Selector de métrica activa */}
          <select
            value={active}
            onChange={(e) => { setActive(e.target.value as ActiveField); setTooltip(null); }}
            style={selectStyle}
          >
            {fields.map(([field, cfg]) => (
              <option key={field} value={field}>{cfg.label(lang)}</option>
            ))}
          </select>

          {/* Periodo: de dónde vienen los datos Y cómo se agrupan (day = rango global agrupado por día, week/month = fetch propio agrupado por semana/mes) */}
          <div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {(["day", "week", "month"] as ChartPeriod[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "0.25rem 0.625rem", fontSize: "0.72rem", fontWeight: 600, border: "none", cursor: "pointer",
                background: period === p ? "var(--color-border)" : "transparent",
                color: period === p ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              }}>
                {p === "day" ? (lang === "es" ? "Día" : "Day") : p === "week" ? (lang === "es" ? "Semana" : "Week") : (lang === "es" ? "Mes" : "Month")}
              </button>
            ))}
          </div>

          {/* Toggle MA */}
          <button onClick={() => setShowMA((v) => !v)} style={{
            padding: "0.25rem 0.625rem", fontSize: "0.72rem", fontWeight: 600, border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)", cursor: "pointer",
            background: showMA ? `${activeCfg.color}18` : "transparent",
            color: showMA ? activeCfg.color : "var(--color-text-secondary)",
          }}>
            {lang === "es" ? `MA ${maWindow}` : `MA ${maWindow}`}
          </button>

          <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
            {grouped.length} {lang === "es" ? "registros" : "records"} · {grouped[0]?.date?.slice(0, 10)} → {grouped[grouped.length - 1]?.date?.slice(0, 10)}
          </div>
        </div>
      </div>

      {tooltip && (
        <div style={{
          position: "absolute", background: "var(--color-surface)", border: `1px solid ${activeCfg.color}`,
          borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", fontSize: "0.8rem",
          pointerEvents: "none", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          left: tooltip.x + 16, top: tooltip.y - 16,
        }}>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.2rem" }}>{formatDate(tooltip.date)}</div>
          <div style={{ fontWeight: 800, color: activeCfg.color, fontSize: "1rem" }}>{tooltip.value.toFixed(1)}%</div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>Target: {activeCfg.target}%</div>
          <div style={{ fontSize: "0.72rem", color: tooltip.value >= activeCfg.target ? "#10b981" : "#ef4444", fontWeight: 600 }}>
            {tooltip.value >= activeCfg.target ? `+${(tooltip.value - activeCfg.target).toFixed(1)}pp ✓` : `${(tooltip.value - activeCfg.target).toFixed(1)}pp`}
          </div>
        </div>
      )}

      {/* Franja compacta: valor activo + delta contra target */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.625rem", marginBottom: "0.625rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
          {activeCfg.label(lang)}
        </span>
        <span style={{ fontSize: "1.25rem", fontWeight: 800, color: activeCfg.color }}>
          {latest.toFixed(1)}%
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
          Target: {activeCfg.target}%
        </span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: meetsTarget ? "#10b981" : "#ef4444" }}>
          {meetsTarget ? `+${delta.toFixed(1)}pp ✓` : `${delta.toFixed(1)}pp`}
        </span>
      </div>

      <div style={{ position: "relative" }}>
        {periodLoading && (
          <div style={spinnerOverlay}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: activeCfg.color }} />
          </div>
        )}
        <LineChart
          data={grouped} field={active} color={activeCfg.color}
          target={activeCfg.target} height={compact ? 190 : 300} compact={compact}
          maWindow={maWindow} showMA={showMA}
          onHover={(t) => setTooltip(t)}
        />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const card: React.CSSProperties         = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem", position: "relative" };
const sectionTitle: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 };
const selectStyle: React.CSSProperties  = {
  padding: "0.25rem 0.5rem", fontSize: "0.72rem", fontWeight: 600, borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)",
  cursor: "pointer",
};
const spinnerOverlay: React.CSSProperties = {
  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
  background: "color-mix(in srgb, var(--color-surface) 70%, transparent)", zIndex: 5,
};