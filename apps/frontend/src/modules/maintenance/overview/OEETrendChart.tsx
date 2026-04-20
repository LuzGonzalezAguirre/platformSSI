import { useState, useMemo } from "react";
import { OEETrendPoint } from "./types";

interface Props { data: OEETrendPoint[]; lang: string; }

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
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }} onMouseLeave={() => onHover?.(null)}>
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

export default function OEETrendChart({ data, lang }: Props) {
  const [active,    setActive]    = useState<ActiveField>("oee_pct");
  const [tooltip,   setTooltip]   = useState<TooltipData | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("daily");
  const [showMA,    setShowMA]    = useState(true);

  const grouped = useMemo(() => groupData(data, groupMode), [data, groupMode]);
  const maWindow = groupMode === "daily" ? 7 : groupMode === "weekly" ? 4 : 3;

  if (data.length === 0) return (
    <div style={card}>
      <div style={sectionTitle}>OEE Trend</div>
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
        {lang === "es" ? "Sin registros de OEE en el rango seleccionado" : "No OEE records in selected range"}
      </div>
    </div>
  );

  const fields     = Object.entries(FIELD_CONFIG) as [ActiveField, typeof FIELD_CONFIG[ActiveField]][];
  const activeCfg  = FIELD_CONFIG[active];
  const latest     = grouped[grouped.length - 1]?.[active] as number ?? 0;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>OEE Trend</div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Agrupación */}
          <div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {(["daily", "weekly", "monthly"] as GroupMode[]).map((m) => (
              <button key={m} onClick={() => setGroupMode(m)} style={{
                padding: "0.25rem 0.625rem", fontSize: "0.72rem", fontWeight: 600, border: "none", cursor: "pointer",
                background: groupMode === m ? "var(--color-border)" : "transparent",
                color: groupMode === m ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              }}>
                {m === "daily" ? (lang === "es" ? "Día" : "Day") : m === "weekly" ? (lang === "es" ? "Sem" : "Week") : (lang === "es" ? "Mes" : "Month")}
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "1rem", position: "relative" }}>
        <LineChart
          data={grouped} field={active} color={activeCfg.color}
          target={activeCfg.target} height={260}
          maWindow={maWindow} showMA={showMA}
          onHover={(t) => setTooltip(t)}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {fields.map(([field, cfg]) => {
            const isActive = field === active;
            const val      = grouped[grouped.length - 1]?.[field] as number ?? 0;
            const meets    = val >= cfg.target;
            return (
              <div key={field} onClick={() => { setActive(field); setTooltip(null); }}
                style={{
                  background: isActive ? `${cfg.color}12` : "var(--color-bg)",
                  border: isActive ? `1.5px solid ${cfg.color}` : "1px solid var(--color-border)",
                  borderLeft: `3px solid ${cfg.color}`,
                  borderRadius: "var(--radius-md)", padding: "0.5rem 0.625rem",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: isActive ? cfg.color : "var(--color-text-secondary)" }}>
                    {cfg.label(lang)}
                  </span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 800, color: meets ? "#10b981" : "#ef4444" }}>
                    {val.toFixed(1)}%
                  </span>
                </div>
                <LineChart
                  data={grouped} field={field} color={cfg.color}
                  target={cfg.target} height={40} showYLabel={false} compact
                  maWindow={maWindow} showMA={false}
                />
                <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)", textAlign: "right", marginTop: "0.15rem" }}>
                  Target {cfg.target}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties         = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem", position: "relative" };
const sectionTitle: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 };