import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  QWallService, QWallReport, QWallRow, QWallInspectorRow,
  QWallFailMode, QWallPartRow, QWallPartNumber,
} from "../services/qwall.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = (): string => new Date().toISOString().slice(0, 10);

function getPreset(mode: "week" | "month" | "year"): [string, string] {
  const d = new Date();
  const end = todayStr();
  if (mode === "week")  { d.setDate(d.getDate() - 7);       return [d.toISOString().slice(0, 10), end]; }
  if (mode === "month") { d.setMonth(d.getMonth() - 1);     return [d.toISOString().slice(0, 10), end]; }
  d.setFullYear(d.getFullYear() - 1);                        return [d.toISOString().slice(0, 10), end];
}

function semaphore(val: number, target: number, lowerBetter = false): string {
  if (lowerBetter) return val <= target ? "#10b981" : val <= target * 1.5 ? "#f59e0b" : "#ef4444";
  return val >= target ? "#10b981" : val >= target * 0.9 ? "#f59e0b" : "#ef4444";
}

function fmtDuration(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

function isTestWo(wo: string | number | null | undefined): boolean {
  if (wo === null || wo === undefined) return true;
  const s = String(wo).trim();
  if (!s || s === "0") return true;
  if (/^0+$/.test(s)) return true;
  if (/^[Pp]0+$/.test(s)) return true;
  return false;
}

// ── Tendencia diaria desde rows ───────────────────────────────────────────────

interface DayPoint { date: string; total: number; pass: number; fail: number; pass_rate: number; }

function buildTrend(rows: QWallRow[]): DayPoint[] {
  const map: Record<string, { total: number; pass: number; fail: number }> = {};
  for (const r of rows) {
    if (!map[r.inspection_date]) map[r.inspection_date] = { total: 0, pass: 0, fail: 0 };
    map[r.inspection_date].total++;
    if (r.result === "PASS") map[r.inspection_date].pass++;
    else map[r.inspection_date].fail++;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v, pass_rate: v.total ? (v.pass / v.total) * 100 : 0 }));
}

// ── Derivar agregados desde subset de rows ────────────────────────────────────

function deriveFromRows(rows: QWallRow[]) {
  const total      = rows.length;
  const pass       = rows.filter(r => r.result === "PASS").length;
  const fail       = total - pass;
  const pass_rate  = total ? (pass / total) * 100 : 0;
  const durs       = rows.map(r => r.duration_seconds).filter(Boolean);
  const avg_duration = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  const inspectors = new Set(rows.map(r => r.inspector)).size;
  const part_numbers = new Set(rows.map(r => r.part_number)).size;

  // by_inspector
  const imap: Record<string, { total: number; pass: number; dur: number }> = {};
  for (const r of rows) {
    if (!imap[r.inspector]) imap[r.inspector] = { total: 0, pass: 0, dur: 0 };
    imap[r.inspector].total += 1;
    if (r.result === "PASS") imap[r.inspector].pass += 1;
    if (r.duration_seconds)  imap[r.inspector].dur  += r.duration_seconds;
  }
  const by_inspector: QWallInspectorRow[] = Object.entries(imap).map(([inspector, s]) => ({
    inspector, total: s.total, pass: s.pass, fail: s.total - s.pass,
    pass_rate: s.total ? Math.round((s.pass / s.total) * 10000) / 100 : 0,
    avg_duration: s.total ? s.dur / s.total : 0,
  }));

  // by_part
  const pmap: Record<string, { total: number; pass: number }> = {};
  for (const r of rows) {
    if (!pmap[r.part_number]) pmap[r.part_number] = { total: 0, pass: 0 };
    pmap[r.part_number].total += 1;
    if (r.result === "PASS") pmap[r.part_number].pass += 1;
  }
  const by_part: QWallPartRow[] = Object.entries(pmap).map(([part_number, s]) => ({
    part_number, total: s.total, pass: s.pass, fail: s.total - s.pass,
    pass_rate: s.total ? Math.round((s.pass / s.total) * 10000) / 100 : 0,
  })).sort((a, b) => b.total - a.total);

  // fail_modes
  const fmap: Record<string, number> = {};
  for (const r of rows) {
    if (r.result === "FAIL" && r.fail_modes) {
      for (const fm of r.fail_modes.split(",")) {
        const k = fm.trim();
        if (k) fmap[k] = (fmap[k] ?? 0) + 1;
      }
    }
  }
  const fail_modes: QWallFailMode[] = Object.entries(fmap)
    .map(([fail_mode, count]) => ({ fail_mode, count }))
    .sort((a, b) => b.count - a.count);

  return {
    summary: { total, pass, fail, pass_rate, avg_duration, inspectors, part_numbers },
    by_inspector,
    by_part,
    fail_modes,
    rows,
  };
}

type TimeMode = "week" | "month" | "year";

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg, 10px)",
  padding: "1.25rem",
};

const cardTitle: React.CSSProperties = {
  fontSize: "0.8125rem", fontWeight: 700,
  color: "var(--color-text-primary)", marginBottom: "0.875rem",
};

// ── KPI Tile ──────────────────────────────────────────────────────────────────

function KPITile({ label, value, sub, color, accent }: {
  label: string; value: string; sub?: string; color?: string; accent?: string;
}) {
  return (
    <div style={{ ...card, borderTop: `3px solid ${accent ?? "#3b82f6"}`, padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: "0.25rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: color ?? "var(--color-text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginTop: "0.375rem" }}>{sub}</div>}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────

function Donut({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

// ── HBar ──────────────────────────────────────────────────────────────────────

function HBar({ data, color = "#3b82f6", maxVal }: {
  data: { label: string; value: number }[]; color?: string; maxVal?: number;
}) {
  const max = maxVal ?? Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {data.map(d => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", width: 90, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: 12, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: color, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--color-text-primary)", width: 28, textAlign: "right", flexShrink: 0 }}>
  {typeof d.value === "number" ? parseFloat(d.value.toFixed(2)) : d.value}
</div>
        </div>
      ))}
    </div>
  );
}

// ── PieChart ──────────────────────────────────────────────────────────────────

function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let angle   = -90;
  const paths: JSX.Element[] = [];
  const cx = 70; const cy = 70; const r = 60;
  for (const s of slices) {
    const sweep = (s.value / total) * 360;
    const rad1  = (angle * Math.PI) / 180;
    const rad2  = ((angle + sweep) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad1); const y1 = cy + r * Math.sin(rad1);
    const x2 = cx + r * Math.cos(rad2); const y2 = cy + r * Math.sin(rad2);
    const large = sweep > 180 ? 1 : 0;
    paths.push(
      <path key={s.label}
        d={`M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
        fill={s.color} stroke="var(--color-surface)" strokeWidth={1.5} />
    );
    angle += sweep;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <svg width={140} height={140} viewBox="0 0 140 140">{paths}</svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {slices.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-secondary)" }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: "var(--color-text-primary)", marginLeft: "auto", paddingLeft: "0.5rem" }}>
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TrendChart ────────────────────────────────────────────────────────────────

function TrendChart({ points, lang = "es" }: { points: DayPoint[]; lang?: "es" | "en" }) {

  const [tooltip,      setTooltip]      = useState<{ idx: number; point: DayPoint } | null>(null);
  const [labelMode,    setLabelMode]    = useState<"hover" | "fixed">("hover");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const l = lang === "es";
  if (points.length < 2) return (
    <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem", padding: "1rem" }}>
      {l ? "Sin suficientes datos" : "Not enough data"}
    </div>
  );

  const W      = isFullscreen ? 1100 : 560;
  const H      = isFullscreen ? 320  : 120;
  const padL   = 36; const padR = 12;
  const padT   = labelMode === "fixed" ? 28 : 10;
  const padB   = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n      = points.length;

  const toX = (i: number) => padL + (i / (n - 1)) * chartW;
  const maxTotal = Math.max(...points.map(p => p.total), 1);
  const toY = (v: number) => padT + chartH * (1 - v / maxTotal);

  const passRateLine = points.map((p, i) =>
    `${toX(i).toFixed(1)},${(padT + chartH * (1 - p.pass_rate / 100)).toFixed(1)}`
  ).join(" ");
  const totalLine = points.map((p, i) =>
    `${toX(i).toFixed(1)},${toY(p.total).toFixed(1)}`
  ).join(" ");
  const failLine = points.map((p, i) =>
    `${toX(i).toFixed(1)},${toY(p.fail).toFixed(1)}`
  ).join(" ");

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

  const btnBase: React.CSSProperties = {
    fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem",
    borderRadius: 5, cursor: "pointer", border: "1px solid var(--color-border)",
  };

  const svgContent = (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: "visible", cursor: labelMode === "hover" ? "crosshair" : "default" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = padT + chartH * (1 - pct);
        return (
          <g key={pct}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.5} />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">
              {Math.round(maxTotal * pct)}
            </text>
          </g>
        );
      })}

      {/* Ejes */}
      <line x1={padL} x2={padL}     y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />

      {/* Líneas */}
      <polyline points={totalLine}    fill="none" stroke="#3b82f6" strokeWidth={2}   strokeLinejoin="round" />
      <polyline points={failLine}     fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 2" />
      <polyline points={passRateLine} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => {
        const isHov = tooltip?.idx === i;
        return (
          <circle key={i} cx={toX(i)} cy={toY(p.total)}
            r={isHov ? 5 : 2.5}
            fill={isHov ? "#fff" : "#3b82f6"}
            stroke="#3b82f6" strokeWidth={isHov ? 2 : 0}
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
        const i     = points.indexOf(p);
        const x     = toX(i);
        const isEdge = i === 0 || i === n - 1;
        const anchor = isEdge ? (i === 0 ? "start" : "end") : "middle";
        return (
          <g key={p.date}>
            <line x1={x} x2={x} y1={padT} y2={padT + chartH}
              stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="2 2" />
            <rect x={x - 14} y={padT - 22} width={28} height={16} rx={3}
              fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={0.7} />
            <text x={x} y={padT - 11} textAnchor="middle" fontSize={8} fontWeight={700} fill="#3b82f6">
              {p.total}
            </text>
            {p.fail > 0 && (
              <text x={x} y={toY(p.fail) - 5} textAnchor={anchor} fontSize={7} fontWeight={600} fill="#ef4444">
                {p.fail}F
              </text>
            )}
            <text x={x} y={padT + chartH * (1 - p.pass_rate / 100) - 5}
              textAnchor={anchor} fontSize={7} fill="#10b981">
              {p.pass_rate.toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* Eje X */}
      {labels.map(p => (
        <text key={p.date} x={toX(points.indexOf(p))} y={H - 4}
          textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">
          {p.date.slice(5)}
        </text>
      ))}

      {/* Leyenda */}
      <rect x={padL}      y={H - 22} width={6} height={6} fill="#3b82f6" />
      <text x={padL + 9}  y={H - 16} fontSize={8} fill="var(--color-text-secondary)">Total</text>
      <rect x={padL + 45} y={H - 22} width={6} height={6} fill="#ef4444" />
      <text x={padL + 54} y={H - 16} fontSize={8} fill="var(--color-text-secondary)">FAIL</text>
      <rect x={padL + 85} y={H - 22} width={6} height={6} fill="#10b981" />
      <text x={padL + 94} y={H - 16} fontSize={8} fill="var(--color-text-secondary)">Pass Rate</text>
    </svg>
  );

  const toolbar = (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", marginBottom: "0.5rem" }}>
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

  // Tooltip flotante
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
        {tooltip.point.date}
      </div>
      {([["#3b82f6","Total",tooltip.point.total],["#10b981","PASS",tooltip.point.pass],["#ef4444","FAIL",tooltip.point.fail]] as [string,string,number][]).map(([c,lb,v]) => (
        <div key={lb} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <span style={{ color: c }}>{lb}</span>
          <span style={{ fontWeight: 700 }}>{v}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem",
        borderTop: "1px solid var(--color-border)", paddingTop: "0.15rem", marginTop: "0.1rem" }}>
        <span style={{ color: "#10b981" }}>Pass Rate</span>
        <span style={{ fontWeight: 700 }}>{tooltip.point.pass_rate.toFixed(1)}%</span>
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
            {l ? "Tendencia diaria" : "Daily trend"}
          </span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
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

// ── VBar ──────────────────────────────────────────────────────────────────────

function VBar({ data }: { data: { label: string; pass: number; fail: number }[] }) {
  const max = Math.max(...data.map(d => d.pass + d.fail), 1);
  const W = 480; const H = 120;
  const padL = 8; const padR = 8; const padT = 10; const padB = 30;
  const chartH = H - padT - padB;
  const bw = Math.min(32, (W - padL - padR) / data.length - 4);
  const spacing = (W - padL - padR) / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {data.map((d, i) => {
        const x = padL + i * spacing + spacing / 2 - bw / 2;
        const passH  = (d.pass / max) * chartH;
        const failH  = (d.fail / max) * chartH;
        const totalH = passH + failH;
        return (
          <g key={d.label}>
            <rect x={x} y={padT + chartH - totalH} width={bw} height={passH} fill="#10b981" rx={2} />
            <rect x={x} y={padT + chartH - failH}  width={bw} height={failH} fill="#ef4444" rx={2} />
            <text x={x + bw/2} y={padT + chartH - totalH - 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--color-text-primary)">
              {d.pass + d.fail}
            </text>
            <text x={x + bw/2} y={H - 4} textAnchor="middle" fontSize={7.5} fill="var(--color-text-secondary)">
              {d.label.split(" ")[0]}
            </text>
          </g>
        );
      })}
      <rect x={padL}      y={2} width={6} height={6} fill="#10b981" />
      <text x={padL + 9}  y={8} fontSize={8} fill="var(--color-text-secondary)">PASS</text>
      <rect x={padL + 42} y={2} width={6} height={6} fill="#ef4444" />
      <text x={padL + 51} y={8} fontSize={8} fill="var(--color-text-secondary)">FAIL</text>
    </svg>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function QWallDashboardPage() {
  const { i18n } = useTranslation();
  const l        = i18n.language === "es";

  const [mode,        setMode]        = useState<TimeMode>("week");
  const [startDate,   setStartDate]   = useState<string>(getPreset("week")[0]);
  const [endDate,     setEndDate]     = useState<string>(todayStr());
  const [data,        setData]        = useState<QWallReport | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [includeTest, setIncludeTest] = useState<boolean>(false);
  const [partCatalog, setPartCatalog] = useState<QWallPartNumber[]>([]);
  const [buFilter,    setBuFilter]    = useState<string>("");

  // Cargar catálogo BU/PN una sola vez
  useEffect(() => {
    QWallService.getPartNumbers().then(setPartCatalog).catch(() => {});
  }, []);

  const buList: string[] = [...new Set(partCatalog.map(p => p.bu_name))].sort();

  // Part numbers válidos para la BU seleccionada
  const pnForBu: string[] = buFilter
    ? partCatalog.filter(p => p.bu_name === buFilter).map(p => p.ssiPN)
    : partCatalog.map(p => p.ssiPN);

  const applyPreset = (m: TimeMode) => {
    setMode(m);
    const [s, e] = getPreset(m);
    setStartDate(s);
    setEndDate(e);
  };

  const load = useCallback(async (s = startDate, e = endDate) => {
    setLoading(true);
    setError(null);
    try {
      setData(await QWallService.getReport(s, e, includeTest));
    } catch {
      setError(l ? "Error cargando datos." : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, includeTest, l]);

  // Auto-reload cuando cambia el toggle (solo si ya hay datos)
  useEffect(() => {
    if (data !== null) load(startDate, endDate);
  }, [includeTest]);

  // Filtrar rows por BU y derivar todos los agregados client-side
  const filteredRows: QWallRow[] = data
    ? (pnForBu.length > 0
        ? data.rows.filter(r => pnForBu.includes(r.part_number))
        : data.rows)
    : [];

  const derived     = data ? deriveFromRows(filteredRows) : null;
  const trend       = derived ? buildTrend(derived.rows) : [];
  const passRate    = derived?.summary.pass_rate ?? 0;
  const failCount   = derived?.summary.fail ?? 0;
  const topFails    = (derived?.fail_modes ?? []).slice(0, 8);
  const inspectors  = derived?.by_inspector ?? [];
  const byPart      = derived?.by_part ?? [];

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: 600,
    borderRadius: "var(--radius-sm, 6px)", cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: active ? "#3b82f6" : "var(--color-surface)",
    color:      active ? "#fff"    : "var(--color-text-secondary)",
  });

  const inputStyle: React.CSSProperties = {
    padding: "0.3rem 0.5rem", fontSize: "0.75rem",
    borderRadius: "var(--radius-sm, 6px)",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-text-primary)",
  };

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            {l ? "Dashboard Q-Wall" : "Q-Wall Dashboard"}
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.2rem 0 0" }}>
            {l ? "Inspecciones de calidad — análisis visual" : "Quality inspections — visual analysis"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {/* Presets */}
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {(["week", "month", "year"] as TimeMode[]).map(m => (
              <button key={m} style={toggleStyle(mode === m)} onClick={() => applyPreset(m)}>
                {m === "week" ? (l ? "Semana" : "Week") : m === "month" ? (l ? "Mes" : "Month") : (l ? "Año" : "Year")}
              </button>
            ))}
          </div>

          {/* Fechas */}
          <input type="date" value={startDate} max={endDate} style={inputStyle}
            onChange={e => { setStartDate(e.target.value); setMode("week"); }} />
          <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>→</span>
          <input type="date" value={endDate} max={todayStr()} style={inputStyle}
            onChange={e => { setEndDate(e.target.value); setMode("week"); }} />

          {/* Filtro BU */}
          <select style={inputStyle} value={buFilter} onChange={e => setBuFilter(e.target.value)}>
            <option value="">{l ? "— Todas las BU —" : "— All BUs —"}</option>
            {buList.map(bu => <option key={bu} value={bu}>{bu}</option>)}
          </select>

          {/* Toggle pruebas/producción */}
          <button
            style={{
              ...inputStyle, fontWeight: 600, cursor: "pointer",
              background: includeTest ? "rgba(245,158,11,0.12)" : "var(--color-surface)",
              color:      includeTest ? "#f59e0b"               : "var(--color-text-secondary)",
              border:     includeTest ? "1px solid #f59e0b"     : "1px solid var(--color-border)",
            }}
            onClick={() => setIncludeTest(v => !v)}
            title={l ? "Alternar producción / pruebas" : "Toggle production / tests"}
          >
             {includeTest ? (l ? "Pruebas" : "Tests") : (l ? "Producción" : "Production")}
          </button>

          {/* Reload */}
          <button onClick={() => load(startDate, endDate)} disabled={loading}
            style={{ ...inputStyle, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      {/* Badge BU activa */}
      {buFilter && data && (
        <div>
          <span style={{
            background: "rgba(59,130,246,0.1)", color: "#3b82f6",
            border: "1px solid #3b82f6", borderRadius: 8,
            padding: "0.25rem 0.75rem", fontSize: "0.8rem", fontWeight: 600,
          }}>
            BU: {buFilter} · {filteredRows.length} {l ? "inspecciones" : "inspections"}
          </span>
        </div>
      )}

      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "8px", color: "#ef4444", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {!data && !loading && (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          {l ? "Selecciona un período y presiona ↻" : "Select a period and press ↻"}
        </div>
      )}

      {loading && (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          {l ? "Cargando datos..." : "Loading data..."}
        </div>
      )}

      {data && !loading && derived && (
        <>
          {/* ── FILA 1: KPIs ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.875rem" }}>
            <KPITile label={l ? "Total Inspecciones" : "Total Inspections"} value={derived.summary.total.toLocaleString()} accent="#3b82f6" />
            <KPITile label="PASS" value={derived.summary.pass.toLocaleString()} color="#10b981" accent="#10b981" />
            <KPITile label="FAIL" value={derived.summary.fail.toLocaleString()} color={failCount > 0 ? "#ef4444" : "#10b981"} accent="#ef4444" />
            <KPITile label={l ? "Tasa de Aprobación" : "Pass Rate"} value={`${passRate.toFixed(1)}%`}
              color={semaphore(passRate, 95)} accent={semaphore(passRate, 95)} sub="Meta ≥ 95%" />
            <KPITile label={l ? "Tiempo Promedio" : "Avg Cycle Time"} value={fmtDuration(Math.round(derived.summary.avg_duration))} accent="#8b5cf6" sub="mm:ss" />
            <KPITile label={l ? "Inspectores" : "Inspectors"} value={String(derived.summary.inspectors)} accent="#f59e0b" />
          </div>

          {/* ── FILA 2: Donut + Pie part + Pie tipo ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div style={card}>
              <div style={cardTitle}>{l ? "Resultado Global" : "Overall Result"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                <Donut pct={passRate} color={semaphore(passRate, 95)} size={100} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[["#10b981","PASS",derived.summary.pass],["#ef4444","FAIL",derived.summary.fail]].map(([c,lb,v]) => (
                    <div key={String(lb)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: String(c) }} />
                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>{lb}</span>
                      <span style={{ fontWeight: 700, color: "var(--color-text-primary)", marginLeft: "auto" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>{l ? "Distribución por Part Number" : "By Part Number"}</div>
              <PieChart slices={byPart.slice(0, 5).map((p: QWallPartRow, i: number) => ({
                label: p.part_number, value: p.total,
                color: ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444"][i % 5],
              }))} />
            </div>

            <div style={card}>
              <div style={cardTitle}>{l ? "Distribución por Tipo" : "By Inspection Type"}</div>
              {(() => {
                const typeMap: Record<string, number> = {};
                for (const r of filteredRows) typeMap[r.inspection_type] = (typeMap[r.inspection_type] ?? 0) + 1;
                const colors = ["#3b82f6", "#8b5cf6", "#f59e0b"];
                return <PieChart slices={Object.entries(typeMap).map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))} />;
              })()}
            </div>
          </div>

          {/* ── FILA 3: Tendencia ── */}
          <div style={card}>
            <div style={cardTitle}>{l ? "Tendencia diaria" : "Daily trend"}</div>
            <TrendChart points={trend} lang={l ? "es" : "en"} />
          </div>

          {/* ── FILA 4: Fail modes + Inspectores ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={card}>
              <div style={cardTitle}>{l ? "Top fallas (Pareto)" : "Top fail modes (Pareto)"}</div>
              {topFails.length === 0
                ? <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{l ? "Sin fallas." : "No failures."}</p>
                : <HBar data={topFails.map((f: QWallFailMode) => ({ label: f.fail_mode, value: f.count }))} color="#ef4444" />
              }
            </div>
            <div style={card}>
              <div style={cardTitle}>{l ? "Inspecciones por inspector" : "By inspector"}</div>
              {inspectors.length === 0
                ? <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>—</p>
                : <VBar data={inspectors.map((r: QWallInspectorRow) => ({ label: r.inspector, pass: r.pass, fail: r.fail }))} />
              }
            </div>
          </div>

          {/* ── FILA 5: Pass rate ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={card}>
              <div style={cardTitle}>{l ? "Pass rate por inspector" : "Pass rate by inspector"}</div>
              <HBar data={inspectors.map((r: QWallInspectorRow) => ({ label: r.inspector, value: r.pass_rate }))} color="#10b981" maxVal={100} />
            </div>
            <div style={card}>
              <div style={cardTitle}>{l ? "Pass rate por part number" : "Pass rate by part number"}</div>
              <HBar data={byPart.map((r: QWallPartRow) => ({ label: r.part_number, value: r.pass_rate }))} color="#3b82f6" maxVal={100} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}