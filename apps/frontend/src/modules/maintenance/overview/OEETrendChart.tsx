import { useState } from "react";
import { OEETrendPoint } from "./types";

interface Props {
  data: OEETrendPoint[];
  lang: string;
}

type ActiveField = "oee_pct" | "availability_pct" | "performance_pct" | "quality_pct";

const FIELD_CONFIG: Record<ActiveField, { label: (lang: string) => string; color: string; target: number }> = {
  oee_pct:          { label: () => "OEE",                                          color: "#1e3a5f", target: 65 },
  availability_pct: { label: (l) => l === "es" ? "Disponibilidad" : "Availability", color: "#10b981", target: 90 },
  performance_pct:  { label: () => "Performance",                                   color: "#f59e0b", target: 85 },
  quality_pct:      { label: (l) => l === "es" ? "Calidad" : "Quality",            color: "#ef4444", target: 98 },
};

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TooltipData {
  x: number;
  y: number;
  date: string;
  value: number;
}

function LineChart({
  data, field, color, target, height = 260, showYLabel = true, compact = false,
  onHover,
}: {
  data: OEETrendPoint[]; field: ActiveField; color: string;
  target: number; height?: number; showYLabel?: boolean; compact?: boolean;
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
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  function toX(i: number) { return padL + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2); }
  function toY(v: number) { return padT + chartH - (v / 100) * chartH; }

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

  return (
    <svg
      width="100%" viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Y grid */}
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={padL} x2={padL + chartW} y1={toY(tick)} y2={toY(tick)}
            stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3,3" />
          {showYLabel && (
            <text x={padL - 6} y={toY(tick) + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">{tick}</text>
          )}
        </g>
      ))}

      {/* Target */}
      <line x1={padL} x2={padL + chartW} y1={toY(target)} y2={toY(target)}
        stroke={color} strokeWidth={1} strokeDasharray="4,4" opacity={0.4} />
      {!compact && (
        <text x={padL + chartW + 4} y={toY(target) + 3} fontSize={8} fill={color} opacity={0.7}>
          {target}%
        </text>
      )}

      {/* Area */}
      {data.length > 1 && (
        <path
          d={`${path} L${toX(data.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)} L${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)} Z`}
          fill={color} opacity={0.08}
        />
      )}

      {/* Line */}
      {data.length > 1 && (
        <path d={path} fill="none" stroke={color} strokeWidth={compact ? 1.5 : 2}
          strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Points — interactivos */}
      {values.map((v, i) => (
        <circle
          key={i}
          cx={toX(i)} cy={toY(v)}
          r={compact ? 2 : 4}
          fill={color}
          style={{ cursor: onHover ? "crosshair" : "default" }}
          onMouseEnter={() => onHover?.({ x: toX(i), y: toY(v), date: data[i].date, value: v })}
        />
      ))}

      {/* X labels */}
      {!compact && data.map((_, i) =>
        i % labelStep === 0 ? (
          <text key={i} x={toX(i)} y={padT + chartH + 14} textAnchor="middle"
            fontSize={8} fill="var(--color-text-secondary)">
            {formatDate(data[i].date)}
          </text>
        ) : null
      )}

      {/* Axes */}
      <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
    </svg>
  );
}

export default function OEETrendChart({ data, lang }: Props) {
  const [active,  setActive]  = useState<ActiveField>("oee_pct");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  if (data.length === 0) return (
    <div style={card}>
      <div style={sectionTitle}>OEE Trend</div>
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
        {lang === "es" ? "Sin registros de OEE en el rango seleccionado" : "No OEE records in selected range"}
      </div>
    </div>
  );

  const fields = Object.entries(FIELD_CONFIG) as [ActiveField, typeof FIELD_CONFIG[ActiveField]][];
  const activeCfg = FIELD_CONFIG[active];

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>OEE Trend</div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
          {data.length} {lang === "es" ? "registros" : "records"} · {formatDate(data[0].date)} → {formatDate(data[data.length - 1].date)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "calc(100% - 180px - 1rem) 180px", gap: "1rem", alignItems: "start" }}>

        {/* Gráfica grande */}
        <div style={{ position: "relative"  }}>
          <div style={{
            background: "var(--color-bg)",
            border: `1px solid ${activeCfg.color}50`,
            borderRadius: "var(--radius-md)",
            padding: "1rem",
            position: "relative",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: activeCfg.color }}>
                {activeCfg.label(lang)}
              </span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: activeCfg.color }}>
                {(data[data.length - 1][active] as number).toFixed(1)}%
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginLeft: "0.375rem", fontWeight: 500 }}>
                  {lang === "es" ? "último" : "latest"}
                </span>
              </span>
            </div>

            <LineChart
              data={data} field={active} color={activeCfg.color}
              target={activeCfg.target} height={220} showYLabel
              onHover={setTooltip}
            />

            {/* Tooltip flotante */}
            {tooltip && (
              <div style={{
                position: "absolute",
                top: "3.5rem",
                left: `calc(${(tooltip.x / 500) * 100}% + 1rem)`,
                transform: "translateX(-50%)",
                background: "var(--color-surface)",
                border: `1px solid ${activeCfg.color}`,
                borderRadius: "var(--radius-md)",
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                pointerEvents: "none",
                zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
              }}>
                <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.2rem" }}>
                  {formatDate(tooltip.date)}
                </div>
                <div style={{ color: activeCfg.color, fontWeight: 800, fontSize: "0.875rem" }}>
                  {tooltip.value.toFixed(1)}%
                </div>
                <div style={{ color: "var(--color-text-secondary)", marginTop: "0.2rem" }}>
                  Target: {activeCfg.target}%
                </div>
                <div style={{ color: tooltip.value >= activeCfg.target ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                  {tooltip.value >= activeCfg.target
                    ? `+${(tooltip.value - activeCfg.target).toFixed(1)}pp ✓`
                    : `${(tooltip.value - activeCfg.target).toFixed(1)}pp`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4 mini cards — siempre todas visibles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {fields.map(([field, cfg]) => {
            const isActive = field === active;
            const latest   = (data[data.length - 1][field] as number);
            const meets    = latest >= cfg.target;
            return (
              <div
                key={field}
                onClick={() => { setActive(field); setTooltip(null); }}
                style={{
                  background: isActive ? `${cfg.color}12` : "var(--color-bg)",
                  border: isActive ? `1.5px solid ${cfg.color}` : "1px solid var(--color-border)",
                  borderLeft: `3px solid ${cfg.color}`,
                  borderRadius: "var(--radius-md)",
                  padding: "0.5rem 0.625rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.boxShadow = `0 0 0 2px ${cfg.color}40`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: isActive ? cfg.color : "var(--color-text-secondary)" }}>
                    {cfg.label(lang)}
                  </span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 800, color: meets ? "#10b981" : "#ef4444" }}>
                    {latest.toFixed(1)}%
                  </span>
                </div>
                <LineChart
                  data={data} field={field} color={cfg.color}
                  target={cfg.target} height={40} showYLabel={false} compact
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

const card: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)", padding: "1.25rem",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0,
};