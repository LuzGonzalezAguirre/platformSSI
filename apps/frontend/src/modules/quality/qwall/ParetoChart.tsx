import { useEffect, useState } from "react";
import { QWallService, QWallFailMode, QWallTrendGranularity } from "../services/qwall.service";
import GranularityToggle from "./GranularityToggle";

// ── ParetoChart ───────────────────────────────────────────────────────────────
// Barras VERTICALES por fail mode (top 10, ya ordenado desc por count desde
// backend) + línea de % acumulado superpuesta sobre un eje secundario derecho
// 0-100%. Un solo ranking agregado por ventana de granularidad (no serie
// temporal). Todo el cálculo (pct_of_total, cumulative_pct, traducción del
// nombre) viene ya resuelto del backend.

interface ParetoChartProps {
  startDate:   string;
  endDate:     string;
  includeTest: boolean;
  buId?:       number;
  lang?:       "es" | "en";
}

const btnBase: React.CSSProperties = {
  fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem",
  borderRadius: 5, cursor: "pointer", border: "1px solid var(--color-border)",
};

export default function ParetoChart({ startDate, endDate, includeTest, buId, lang = "es" }: ParetoChartProps) {
  const l = lang === "es";

  const [granularity,  setGranularity]  = useState<QWallTrendGranularity>("daily");
  const [items,        setItems]        = useState<QWallFailMode[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [hoverIdx,     setHoverIdx]     = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    QWallService.getPareto(granularity, startDate, endDate, includeTest, buId, 10)
      .then(res => { if (!cancelled) setItems(res.items); })
      .catch(() => { if (!cancelled) setError(l ? "Error cargando fallas." : "Failed to load failures."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [granularity, startDate, endDate, includeTest, buId, l]);

  const toolbar = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
      <GranularityToggle value={granularity} onChange={setGranularity} lang={lang} />
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
  );

  if (loading && items.length === 0) {
    return <>{toolbar}<div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem", padding: "1rem" }}>{l ? "Cargando..." : "Loading..."}</div></>;
  }
  if (error) {
    return <>{toolbar}<div style={{ color: "#ef4444", fontSize: "0.8rem", padding: "1rem" }}>{error}</div></>;
  }
  if (items.length === 0) {
    return <>{toolbar}<p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{l ? "Sin fallas." : "No failures."}</p></>;
  }

  const n       = items.length;
  const W       = isFullscreen ? 1100 : 560;
  const H       = isFullscreen ? 340  : 200;
  const padL    = 34; const padR = 40;
  const padT    = 18; const padB = 34;
  const chartW  = W - padL - padR;
  const chartH  = H - padT - padB;
  const maxCount = Math.max(...items.map(i => i.count), 1);

  const bw      = Math.min(48, chartW / n - 10);
  const spacing = chartW / n;
  const barX    = (i: number) => padL + i * spacing + spacing / 2 - bw / 2;
  const barCenterX = (i: number) => padL + i * spacing + spacing / 2;
  const toYCount = (v: number) => padT + chartH * (1 - v / maxCount);
  const toYPct   = (v: number) => padT + chartH * (1 - v / 100);

  const cumulativeLine = items.map((it, i) => `${barCenterX(i).toFixed(1)},${toYPct(it.cumulative_pct).toFixed(1)}`).join(" ");

  const hovered = hoverIdx !== null ? items[hoverIdx] : null;

  const svgContent = (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Grid izquierdo: count */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = padT + chartH * (1 - pct);
        return (
          <g key={pct}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.5} />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">
              {Math.round(maxCount * pct)}
            </text>
          </g>
        );
      })}

      {/* Eje derecho: % acumulado */}
      <line x1={W - padR} x2={W - padR} y1={padT} y2={padT + chartH} stroke="#f59e0b" strokeWidth={0.8} />
      {[0, 25, 50, 75, 100].map(pct => {
        const y = padT + chartH * (1 - pct / 100);
        return (
          <g key={`rax${pct}`}>
            <line x1={W - padR} x2={W - padR + 3} y1={y} y2={y} stroke="#f59e0b" strokeWidth={0.8} />
            <text x={W - padR + 5} y={y + 3} textAnchor="start" fontSize={7} fill="#f59e0b">{pct}%</text>
          </g>
        );
      })}

      {/* Barras */}
      {items.map((it, i) => {
        const isHov = hoverIdx === i;
        const barH  = (it.count / maxCount) * chartH;
        return (
          <g
            key={it.code}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: "pointer" }}
          >
            <rect x={barX(i)} y={padT + chartH - barH} width={bw} height={barH}
              fill="#ef4444" opacity={isHov ? 1 : 0.85} rx={2} />
            <text x={barCenterX(i)} y={padT + chartH - barH - 4} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--color-text-primary)">
              {it.count}
            </text>
            <text x={barCenterX(i)} y={H - padB + 12} textAnchor="middle" fontSize={8} fontWeight={600} fill="var(--color-text-secondary)">
              {it.code}
            </text>
          </g>
        );
      })}

      {/* Línea de % acumulado */}
      <polyline points={cumulativeLine} fill="none" stroke="#f59e0b" strokeWidth={1.6} strokeLinejoin="round" />
      {items.map((it, i) => (
        <circle key={`dot-${it.code}`} cx={barCenterX(i)} cy={toYPct(it.cumulative_pct)}
          r={hoverIdx === i ? 4 : 2.5} fill="#f59e0b" stroke="var(--color-surface)" strokeWidth={1} />
      ))}
    </svg>
  );

  const tooltipEl = hovered ? (
    <div style={{
      position: "absolute",
      left: `${(barCenterX(hoverIdx as number) / W) * 100}%`,
      top: `${((toYCount(hovered.count) - 10) / H) * 100}%`,
      transform: "translate(-50%, -100%)",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "8px", padding: "0.5rem 0.75rem",
      fontSize: "0.72rem", color: "var(--color-text-primary)",
      pointerEvents: "none", zIndex: 20,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      whiteSpace: "nowrap",
    }}>
      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{hovered.name}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <span style={{ color: "var(--color-text-secondary)" }}>{l ? "Conteo" : "Count"}</span>
        <span style={{ fontWeight: 700 }}>{hovered.count}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <span style={{ color: "var(--color-text-secondary)" }}>% {l ? "del total" : "of total"}</span>
        <span style={{ fontWeight: 700 }}>{hovered.pct_of_total.toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <span style={{ color: "#f59e0b" }}>{l ? "% acumulado" : "Cumulative %"}</span>
        <span style={{ fontWeight: 700 }}>{hovered.cumulative_pct.toFixed(1)}%</span>
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
            {l ? "Top fallas (Pareto)" : "Top fail modes (Pareto)"}
          </span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <GranularityToggle value={granularity} onChange={setGranularity} lang={lang} />
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
