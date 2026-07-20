import { useEffect, useState } from "react";
import { QWallService, QWallTrendPoint, QWallTrendGranularity } from "../services/qwall.service";
import GranularityToggle from "./GranularityToggle";

// ── TrendChart ────────────────────────────────────────────────────────────────
// Tendencia de Pass Rate vs Target, con granularidad propia (Daily/Week/Month),
// independiente del filtro general de fechas del dashboard (que sólo aplica al
// modo Daily). Todo el cálculo (pass_rate, status on_target/below_target) viene
// ya resuelto del backend.

interface TrendChartProps {
  startDate:   string;
  endDate:     string;
  includeTest: boolean;
  buId?:       number;
  locale:      string;
}

const btnBase: React.CSSProperties = {
  fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem",
  borderRadius: 5, cursor: "pointer", border: "1px solid var(--color-border)",
};

function periodLabel(p: QWallTrendPoint, granularity: QWallTrendGranularity, locale: string, l: boolean): string {
  if (granularity === "weekly")  return `${l ? "Semana" : "Week"} ${p.week ?? ""}`;
  if (granularity === "monthly") return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(p.period));
  return p.period.slice(5);
}

export default function TrendChart({ startDate, endDate, includeTest, buId, locale }: TrendChartProps) {
  const l = locale.startsWith("es");

  const [granularity,  setGranularity]  = useState<QWallTrendGranularity>("daily");
  const [points,       setPoints]       = useState<QWallTrendPoint[]>([]);
  const [targetPct,    setTargetPct]    = useState<number>(95);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [tooltip,      setTooltip]      = useState<{ idx: number; point: QWallTrendPoint } | null>(null);
  const [labelMode,    setLabelMode]    = useState<"hover" | "fixed">("hover");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    QWallService.getTrend(granularity, startDate, endDate, includeTest, buId)
      .then(res => {
        if (cancelled) return;
        setPoints(res.points);
        setTargetPct(res.target_pct);
      })
      .catch(() => { if (!cancelled) setError(l ? "Error cargando tendencia." : "Failed to load trend."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [granularity, startDate, endDate, includeTest, buId, l]);

  const granularityToggle = (
    <GranularityToggle value={granularity} onChange={setGranularity} lang={l ? "es" : "en"} />
  );

  if (loading && points.length === 0) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>{granularityToggle}</div>
        <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem", padding: "1rem" }}>
          {l ? "Cargando..." : "Loading..."}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>{granularityToggle}</div>
        <div style={{ color: "#ef4444", fontSize: "0.8rem", padding: "1rem" }}>{error}</div>
      </>
    );
  }

  if (points.length < 2) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>{granularityToggle}</div>
        <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem", padding: "1rem" }}>
          {l ? "Sin suficientes datos" : "Not enough data"}
        </div>
      </>
    );
  }

  const W      = isFullscreen ? 1100 : 560;
  const H      = isFullscreen ? 340  : 200;
  const padL   = 36; const padR = 34;
  const padT   = labelMode === "fixed" ? 28 : 10;
  const padB   = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n      = points.length;

  const toX = (i: number) => padL + (i / (n - 1)) * chartW;
  const maxFail  = Math.max(...points.map(p => p.fail_count), 1);
  const toYFail  = (v: number) => padT + chartH * (1 - v / maxFail);
  const toYPct   = (v: number) => padT + chartH * (1 - v / 100);

  const passRateLine = points.map((p, i) => `${toX(i).toFixed(1)},${toYPct(p.pass_rate).toFixed(1)}`).join(" ");
  const targetLine   = points.map((p, i) => `${toX(i).toFixed(1)},${toYPct(p.target_pct).toFixed(1)}`).join(" ");
  const failLine     = points.map((p, i) => `${toX(i).toFixed(1)},${toYFail(p.fail_count).toFixed(1)}`).join(" ");

  const step      = Math.max(1, Math.floor(n / (isFullscreen ? 12 : 6)));
  const labels    = points.filter((_, i) => i % step === 0 || i === n - 1);
  const fixedStep = Math.max(1, Math.floor(n / (isFullscreen ? 20 : 8)));
  const fixedLabels = points.filter((_, i) => i % fixedStep === 0 || i === n - 1);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (labelMode === "fixed") return;
    const rect   = e.currentTarget.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    let closest = 0; let minDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(toX(i) - mouseX);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setTooltip({ idx: closest, point: points[closest] });
  };

  const svgContent = (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: "visible", cursor: labelMode === "hover" ? "crosshair" : "default" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Grid (eje izquierdo: fail count) */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = padT + chartH * (1 - pct);
        return (
          <g key={pct}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.5} />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">
              {Math.round(maxFail * pct)}
            </text>
          </g>
        );
      })}

      {/* Ejes */}
      <line x1={padL} x2={padL}     y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />

      {/* Eje derecho: Pass Rate / Target % */}
      <line x1={W - padR} x2={W - padR} y1={padT} y2={padT + chartH} stroke="#10b981" strokeWidth={0.8} />
      {[0, 25, 50, 75, 100].map(pct => {
        const y = padT + chartH * (1 - pct / 100);
        return (
          <g key={`rax${pct}`}>
            <line x1={W - padR} x2={W - padR + 3} y1={y} y2={y} stroke="#10b981" strokeWidth={0.8} />
            <text x={W - padR + 5} y={y + 3} textAnchor="start" fontSize={7} fill="#10b981">{pct}%</text>
          </g>
        );
      })}

      {/* Líneas */}
      <polyline points={failLine}     fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 2" />
      <polyline points={targetLine}   fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinejoin="round" />
      <polyline points={passRateLine} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Dots de pass rate coloreados por status */}
      {points.map((p, i) => {
        const isHov  = tooltip?.idx === i;
        const color  = p.status === "on_target" ? "#10b981" : "#ef4444";
        return (
          <circle key={i} cx={toX(i)} cy={toYPct(p.pass_rate)}
            r={isHov ? 5 : 3}
            fill={color}
            stroke="var(--color-surface)" strokeWidth={isHov ? 2 : 1}
          />
        );
      })}

      {/* Línea vertical hover */}
      {labelMode === "hover" && tooltip && (
        <line
          x1={toX(tooltip.idx)} x2={toX(tooltip.idx)}
          y1={padT} y2={padT + chartH}
          stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 2"
        />
      )}

      {/* Etiquetas fijas */}
      {labelMode === "fixed" && fixedLabels.map(p => {
        const i      = points.indexOf(p);
        const x      = toX(i);
        const isEdge = i === 0 || i === n - 1;
        const anchor = isEdge ? (i === 0 ? "start" : "end") : "middle";
        const color  = p.status === "on_target" ? "#10b981" : "#ef4444";
        return (
          <g key={`${p.period}-${p.week ?? ""}`}>
            <line x1={x} x2={x} y1={padT} y2={padT + chartH}
              stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="2 2" />
            <rect x={x - 16} y={padT - 22} width={32} height={16} rx={3}
              fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={0.7} />
            <text x={x} y={padT - 11} textAnchor="middle" fontSize={8} fontWeight={700} fill={color}>
              {p.pass_rate.toFixed(0)}%
            </text>
            {p.fail_count > 0 && (
              <text x={x} y={toYFail(p.fail_count) - 5} textAnchor={anchor} fontSize={7} fontWeight={600} fill="#ef4444">
                {p.fail_count}F
              </text>
            )}
          </g>
        );
      })}

      {/* Eje X */}
      {labels.map(p => (
        <text key={`${p.period}-${p.week ?? ""}`} x={toX(points.indexOf(p))} y={H - 4}
          textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">
          {periodLabel(p, granularity, locale, l)}
        </text>
      ))}

      {/* Leyenda */}
      <rect x={padL}      y={H - 22} width={6} height={6} fill="#10b981" />
      <text x={padL + 9}  y={H - 16} fontSize={8} fill="var(--color-text-secondary)">Pass Rate</text>
      <rect x={padL + 62} y={H - 22} width={6} height={6} fill="#f59e0b" />
      <text x={padL + 71} y={H - 16} fontSize={8} fill="var(--color-text-secondary)">{l ? "Meta" : "Target"}</text>
      <rect x={padL + 110} y={H - 22} width={6} height={6} fill="#ef4444" />
      <text x={padL + 119} y={H - 16} fontSize={8} fill="var(--color-text-secondary)">FAIL</text>
    </svg>
  );

  const labelModeBtn = (
    <button
      onClick={() => { setLabelMode(m => m === "hover" ? "fixed" : "hover"); setTooltip(null); }}
      style={{
        ...btnBase,
        background: labelMode === "fixed" ? "rgba(59,130,246,0.12)" : "var(--color-surface)",
        color:      labelMode === "fixed" ? "#3b82f6"               : "var(--color-text-secondary)",
      }}
    >
      {labelMode === "hover" ? (l ? "Etiquetas fijas" : "Fixed labels") : (l ? "Tooltip hover" : "Hover tooltip")}
    </button>
  );

  const toolbar = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
      {granularityToggle}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        {labelModeBtn}
        <button
          onClick={() => setIsFullscreen(v => !v)}
          style={{
            ...btnBase,
            background: isFullscreen ? "rgba(139,92,246,0.12)" : "var(--color-surface)",
            color:      isFullscreen ? "#8b5cf6"               : "var(--color-text-secondary)",
          }}
        >
          {isFullscreen ? (l ? "Reducir" : "Reduce") : (l ? "Pantalla completa" : "Full screen")}
        </button>
      </div>
    </div>
  );

  const tooltipEl = labelMode === "hover" && tooltip ? (
    <div style={{
      position: "absolute",
      left: `${(toX(tooltip.idx) / W) * 100}%`,
      top: "2rem",
      transform: "translate(-50%, 0)",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "8px", padding: "0.5rem 0.75rem",
      fontSize: "0.75rem", color: "var(--color-text-primary)",
      pointerEvents: "none", zIndex: 20,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      whiteSpace: "nowrap",
    }}>
      <div style={{ fontWeight: 700, marginBottom: "0.25rem", color: "var(--color-text-secondary)" }}>
        {periodLabel(tooltip.point, granularity, locale, l)}
      </div>
      {([
        ["#10b981", "Pass Rate", `${tooltip.point.pass_rate.toFixed(1)}%`],
        ["#f59e0b", l ? "Meta" : "Target", `${tooltip.point.target_pct.toFixed(1)}%`],
        ["#ef4444", "FAIL", String(tooltip.point.fail_count)],
      ] as [string, string, string][]).map(([c, lb, v]) => (
        <div key={lb} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <span style={{ color: c }}>{lb}</span>
          <span style={{ fontWeight: 700 }}>{v}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem",
        borderTop: "1px solid var(--color-border)", paddingTop: "0.15rem", marginTop: "0.1rem" }}>
        <span style={{ color: "var(--color-text-secondary)" }}>Total</span>
        <span style={{ fontWeight: 700 }}>{tooltip.point.total_count}</span>
      </div>
    </div>
  ) : null;

  if (isFullscreen) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "var(--color-bg)",
        display: "flex", flexDirection: "column",
        padding: "1.5rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary)" }}>
            {l ? "Tendencia" : "Trend"}
          </span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {granularityToggle}
            {labelModeBtn}
            <button
              onClick={() => setIsFullscreen(false)}
              style={{ ...btnBase, background: "var(--color-surface)", color: "var(--color-text-secondary)" }}
            >
              {l ? "✕ Cerrar" : "✕ Close"}
            </button>
          </div>
        </div>
        <div style={{ position: "relative", flex: 1 }}>
          {tooltipEl}
          {svgContent}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {toolbar}
      {tooltipEl}
      {svgContent}
    </div>
  );
}
