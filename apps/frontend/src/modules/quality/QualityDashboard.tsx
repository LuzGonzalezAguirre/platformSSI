// apps/frontend/src/modules/quality/QualityDashboard.tsx

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Settings, X, Plus, Trash2 } from "lucide-react";
import { QualityService, QualityTarget } from "./services/quality.service";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScrapData {
  summary:       { total_qty: number; total_cost: number; yield_pct: number };
  by_workcenter: WCRow[];
  by_reason:     ReasonRow[];
  by_part:       PartRow[];
  by_shift:      ShiftRow[];
  trend:         TrendRow[];
}

interface WCRow {
  workcenter: string; bu: string; production: number;
  scrap_qty: number; yield_pct: number; scrap_cost: number;
  shift_a: { scrap_qty: number; yield_pct: number };
  shift_b: { scrap_qty: number; yield_pct: number };
}
interface ReasonRow {
  scrap_reason: string; total_qty: number; total_cost: number;
  pct_of_total: number; cumulative_pct: number;
}
interface PartRow {
  part_no: string; part_type: string; workcenter: string; bu: string;
  scrap_qty: number; scrap_cost: number;
}
interface ShiftRow { workcenter: string; shift: string; scrap_qty: number }
interface TrendRow {
  date: string; volvo_qty: number; cummins_qty: number;
  tulc_qty: number; total_qty: number; total_cost: number;
  production: number; yield_pct: number;
}

type BUFilter = "all" | "volvo" | "cummins" | "tulc";

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);
const startOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

function semaphore(value: number, target: number, lowerBetter = false): string {
  if (lowerBetter) return value <= target ? "#10b981" : value <= target * 1.5 ? "#f59e0b" : "#ef4444";
  return value >= target ? "#10b981" : value >= target * 0.9 ? "#f59e0b" : "#ef4444";
}
function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page:        { display: "flex", flexDirection: "column" as const, gap: "1rem" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: "1rem" },
  title:       { fontSize: "1.375rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  subtitle:    { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  filterBar:   { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" as const },
  filterLabel: { fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  input:       { padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  select:      { padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  btnIcon:     { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.8125rem" },
  card:        { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" },
  cardTitle:   { fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: "1rem" },
  kpiGrid:     { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" },
  kpiCard:     { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1rem 1.125rem", display: "flex", flexDirection: "column" as const, gap: "0.375rem" },
  kpiLabel:    { fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  kpiValue:    { fontSize: "1.75rem", fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.1 },
  kpiSub:      { fontSize: "0.75rem", color: "var(--color-text-tertiary)" },
  row2:        { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" },
  row2eq:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  row75:       { display: "grid", gridTemplateColumns: "7fr 5fr", gap: "1rem" },
  barFill:     { position: "absolute" as const, height: "100%", borderRadius: "4px", transition: "width 0.4s ease" },
  errorBanner: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", color: "#b91c1c", fontSize: "0.875rem" },
  loading:     { padding: "3rem", textAlign: "center" as const, color: "var(--color-text-secondary)", fontSize: "0.875rem" },
  overlay:     { position: "fixed" as const, inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" },
  modal:       { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl, 16px)", padding: "2rem", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" as const },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={s.kpiCard}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color }}>{value}</div>
      <div style={s.kpiSub}>{sub}</div>
    </div>
  );
}

// ── Chart base (reutilizable) ─────────────────────────────────────────────────

interface LineChartProps {
  points: { x: number; y: number; label: string; value: number; extra?: string }[];
  color: string;
  yMin?: number;
  yMax: number;
  yFormat?: (v: number) => string;
  refLine?: number;
  refColor?: string;
  legendLabel: string;
  noDataMsg: string;
}

function LineChart({ points, color, yMin = 0, yMax, yFormat, refLine, refColor = "#ef4444", legendLabel, noDataMsg }: LineChartProps) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: number; extra?: string } | null>(null);

  if (!points.length) return (
    <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8125rem", padding: "2rem", textAlign: "center" }}>
      {noDataMsg}
    </div>
  );

  const W = 700; const H = 160;
  const PAD = { top: 20, right: 16, bottom: 32, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const range  = yMax - yMin || 1;

  const xPos = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yPos = (v: number) => PAD.top + innerH - ((v - yMin) / range) * innerH;

  const pts     = points.map((p, i) => ({ ...p, sx: xPos(i), sy: yPos(p.value) }));
  const linePts = pts.map((p) => `${p.sx},${p.sy}`).join(" ");
  const areaPts = [
    `${pts[0].sx},${PAD.top + innerH}`,
    ...pts.map((p) => `${p.sx},${p.sy}`),
    `${pts[pts.length - 1].sx},${PAD.top + innerH}`,
  ].join(" ");

  const step    = Math.max(1, Math.ceil(points.length / 7));
  const xLabels = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  const yTicks  = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: yMin + range * pct,
    y:     yPos(yMin + range * pct),
  }));

  const fmt = yFormat ?? ((v: number) => String(Math.round(v)));

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t.value}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + innerW} y2={t.y}
              stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={PAD.left - 6} y={t.y + 4} fontSize="9" fill="var(--color-text-tertiary)" textAnchor="end">
              {fmt(t.value)}
            </text>
          </g>
        ))}

        <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH}
          stroke="var(--color-border)" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH}
          stroke="var(--color-border)" strokeWidth="1" />

        {refLine !== undefined && (
          <line x1={PAD.left} y1={yPos(refLine)} x2={PAD.left + innerW} y2={yPos(refLine)}
            stroke={refColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
        )}

        <polygon points={areaPts} fill={color} opacity="0.08" />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />

        {hover && (
          <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + innerH}
            stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
        )}

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.sx} cy={p.sy} r={12} fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover({ x: p.sx, y: p.sy, label: p.label, value: p.value, extra: p.extra })} />
            <circle cx={p.sx} cy={p.sy}
              r={hover?.label === p.label ? 5 : 3}
              fill={hover?.label === p.label ? "#fff" : color}
              stroke={color} strokeWidth="2" />
          </g>
        ))}

        {xLabels.map((p) => (
          <text key={p.label} x={p.sx} y={PAD.top + innerH + 16}
            fontSize="9" fill="var(--color-text-tertiary)" textAnchor="middle">
            {p.label}
          </text>
        ))}
      </svg>

      {hover && (
        <div style={{
          position: "absolute",
          left: `${(hover.x / W) * 100}%`,
          top: `${(hover.y / H) * 100}%`,
          transform: "translate(-50%, -110%)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "0.375rem 0.625rem",
          fontSize: "11px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "3px" }}>{hover.label}</div>
          <div style={{ color, fontWeight: 600 }}>{fmt(hover.value)}</div>
          {hover.extra && <div style={{ color: "var(--color-text-tertiary)", marginTop: "2px" }}>{hover.extra}</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--color-text-secondary)" }}>
          <svg width="20" height="8">
            <line x1="0" y1="4" x2="12" y2="4" stroke={color} strokeWidth="2" />
            <circle cx="16" cy="4" r="3" fill="white" stroke={color} strokeWidth="2" />
          </svg>
          {legendLabel}
        </span>
        {refLine !== undefined && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--color-text-tertiary)" }}>
            <svg width="20" height="8">
              <line x1="0" y1="4" x2="20" y2="4" stroke={refColor} strokeWidth="1.5" strokeDasharray="4,2" />
            </svg>
            Meta
          </span>
        )}
      </div>
    </div>
  );
}

// ── Trend Scrap ───────────────────────────────────────────────────────────────

function TrendScrapChart({ data, lang }: { data: TrendRow[]; lang: "es" | "en" }) {
  const n      = data.length;
  const maxQty = Math.max(...data.map((d) => d.total_qty), 1);
  const points = data.map((d) => ({
    x:     0,
    y:     0,
    label: n <= 31 ? d.date.slice(5) : d.date.slice(2, 7),
    value: d.total_qty,
    extra: `${lang === "es" ? "Costo: " : "Cost: "}${fmtCurrency(d.total_cost)} · Volvo: ${d.volvo_qty} · Cummins: ${d.cummins_qty} · TULC: ${d.tulc_qty}`,
  }));

  return (
    <LineChart
      points={points}
      color="#3b82f6"
      yMax={maxQty}
      yFormat={(v) => String(Math.round(v))}
      legendLabel={lang === "es" ? "Scrap diario total" : "Daily total scrap"}
      noDataMsg={lang === "es" ? "Sin datos para el período" : "No data for this period"}
    />
  );
}

// ── Trend Yield ───────────────────────────────────────────────────────────────

function TrendYieldChart({ data, lang, targets }: { data: TrendRow[]; lang: "es" | "en"; targets: QualityTarget[] }) {
  const n    = data.length;
  const meta = QualityService.resolveTarget(targets, "all", "").yield_min_pct;

  const points = data.map((d) => ({
    x:     0,
    y:     0,
    label: n <= 31 ? d.date.slice(5) : d.date.slice(2, 7),
    value: d.yield_pct ?? 100,
    extra: `${lang === "es" ? "Producción: " : "Production: "}${(d.production ?? 0).toLocaleString()} · Scrap: ${d.total_qty ?? 0}`,
  }));

  return (
    <LineChart
      points={points}
      color="#10b981"
      yMin={0}
      yMax={100}
      yFormat={(v) => `${v.toFixed(0)}%`}
      refLine={meta}
      refColor="#ef4444"
      legendLabel={lang === "es" ? "Yield FPY diario" : "Daily FPY yield"}
      noDataMsg={lang === "es" ? "Sin datos para el período" : "No data for this period"}
    />
  );
}

// ── Pareto — barras verticales ────────────────────────────────────────────────

function ParetoChart({ data, topN }: { data: ReasonRow[]; topN: number }) {
  const rows   = data.slice(0, topN);
  const maxQty = rows[0]?.total_qty ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "140px", position: "relative" }}>
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: "80%",
          height: "1.5px", background: "#f59e0b", opacity: 0.8, zIndex: 1,
        }} />
        {rows.map((r) => {
          const heightPct = (r.total_qty / maxQty) * 100;
          const cumColor  = r.cumulative_pct <= 50 ? "#ef4444"
                          : r.cumulative_pct <= 80 ? "#f59e0b"
                          : "#10b981";
          return (
            <div key={r.scrap_reason}
              title={`${r.scrap_reason}\n${r.total_qty} pcs — ${r.cumulative_pct.toFixed(0)}% acum`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", cursor: "default" }}
            >
              <span style={{ fontSize: "9px", color: cumColor, fontWeight: 700, marginBottom: "2px" }}>
                {r.cumulative_pct.toFixed(0)}%
              </span>
              <div style={{
                width: "100%", height: `${heightPct}%`,
                background: cumColor, borderRadius: "3px 3px 0 0",
                minHeight: "4px", opacity: 0.85,
              }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "4px", height: "48px", overflow: "hidden" }}>
        {rows.map((r) => (
          <div key={r.scrap_reason} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <span style={{
              display: "block", fontSize: "9px", color: "var(--color-text-secondary)",
              whiteSpace: "nowrap", transform: "rotate(-35deg)", transformOrigin: "left top",
              marginTop: "4px", marginLeft: "4px", maxWidth: "80px",
            }}>
              {r.scrap_reason}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "0.25rem" }}>
        {rows.map((r) => (
          <div key={r.scrap_reason} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span style={{ color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
              {r.scrap_reason}
            </span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {r.total_qty} pcs · {r.pct_of_total.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "10px", color: "#f59e0b" }}>— línea amarilla = umbral 80%</div>
    </div>
  );
}

// ── Yield por WC ──────────────────────────────────────────────────────────────

function YieldByWC({ data, targets }: { data: WCRow[]; targets: QualityTarget[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {data.map((r) => {
        const meta    = QualityService.resolveTarget(targets, r.bu, r.workcenter);
        const color   = semaphore(r.yield_pct, meta.yield_min_pct);
        const metaPct = meta.yield_min_pct;
        return (
          <div key={r.workcenter} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "130px", fontSize: "11px", color: "var(--color-text-secondary)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.workcenter}
            </span>
            <div style={{ flex: 1, position: "relative", height: "16px", background: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ ...s.barFill, width: `${r.yield_pct}%`, background: color }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${metaPct}%`, width: "1.5px", background: "#ef4444", opacity: 0.7 }} />
            </div>
            <span style={{ width: "42px", fontSize: "11px", color, fontWeight: 700, textAlign: "right" }}>
              {r.yield_pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
      <div style={{ fontSize: "10px", color: "#ef4444", opacity: 0.7, marginTop: "2px" }}>— línea roja = meta por WC/BU</div>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: ShiftRow[] }) {
  const wcs    = [...new Set(data.map((r) => r.workcenter))];
  const maxVal = Math.max(...data.map((r) => r.scrap_qty), 1);

  function cellColor(qty: number): string {
    const pct = qty / maxVal;
    if (pct === 0)  return "var(--color-border)";
    if (pct < 0.25) return "#dcfce7";
    if (pct < 0.5)  return "#fef9c3";
    if (pct < 0.75) return "#fee2e2";
    return "#fca5a5";
  }
  function textColor(qty: number): string {
    const pct = qty / maxVal;
    if (pct < 0.25) return "#14532d";
    if (pct < 0.5)  return "#713f12";
    return "#7f1d1d";
  }

  const getQty = (wc: string, shift: string) =>
    data.find((r) => r.workcenter === wc && r.shift === shift)?.scrap_qty ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "2px" }}>
        <span style={{ width: "90px" }} />
        {["A", "B"].map((sh) => (
          <span key={sh} style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: 700, color: "var(--color-text-secondary)" }}>
            {sh === "A" ? "Turno A (6AM-6PM)" : "Turno B (6PM-6AM)"}
          </span>
        ))}
      </div>
      {wcs.map((wc) => (
        <div key={wc} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "90px", fontSize: "10px", color: "var(--color-text-secondary)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {wc}
          </span>
          {["A", "B"].map((sh) => {
            const qty = getQty(wc, sh);
            return (
              <div key={sh} style={{ flex: 1, height: "24px", borderRadius: "3px", background: cellColor(qty), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: textColor(qty) }}>
                {qty || "—"}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
        <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>bajo</span>
        {["#dcfce7", "#fef9c3", "#fee2e2", "#fca5a5"].map((c) => (
          <div key={c} style={{ width: "14px", height: "8px", borderRadius: "2px", background: c }} />
        ))}
        <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>alto</span>
      </div>
    </div>
  );
}

// ── BU Bars ───────────────────────────────────────────────────────────────────

function BUBars({ data }: { data: WCRow[] }) {
  const bu: Record<string, number> = { volvo: 0, cummins: 0, tulc: 0 };
  data.forEach((r) => { if (bu[r.bu] !== undefined) bu[r.bu] += r.scrap_qty; });
  const total  = Object.values(bu).reduce((a, b) => a + b, 0);
  const colors = { volvo: "#3b82f6", cummins: "#10b981", tulc: "#f59e0b" };
  const labels: Record<string, string> = { volvo: "Volvo", cummins: "Cummins", tulc: "TULC" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "center", height: "100%" }}>
      {(["volvo", "cummins", "tulc"] as const).map((b) => {
        const pct = total > 0 ? (bu[b] / total) * 100 : 0;
        return (
          <div key={b}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{labels[b]}</span>
              <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{bu[b].toLocaleString()} pcs · {pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: "10px", background: "var(--color-border)", borderRadius: "3px" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: colors[b], borderRadius: "3px" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Top Parts ─────────────────────────────────────────────────────────────────

function TopParts({ data, topN }: { data: PartRow[]; topN: number }) {
  const rows    = data.slice(0, topN);
  const maxQty  = rows[0]?.scrap_qty ?? 1;
  const maxCost = Math.max(...rows.map((r) => r.scrap_cost), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <div style={{ display: "flex", gap: "8px", fontSize: "10px", color: "var(--color-text-tertiary)", paddingBottom: "4px", borderBottom: "1px solid var(--color-border)" }}>
        <span style={{ width: "70px" }}>Part No</span>
        <span style={{ width: "90px" }}>Type</span>
        <span style={{ flex: 1 }}>Scrap qty</span>
        <span style={{ width: "38px", textAlign: "right" }}>pcs</span>
        <span style={{ width: "52px", textAlign: "right" }}>costo</span>
      </div>
      {rows.map((r) => {
        const costSeverity = r.scrap_cost / maxCost;
        const barColor = costSeverity > 0.6 ? "#ef4444" : costSeverity > 0.3 ? "#f59e0b" : "#3b82f6";
        return (
          <div key={`${r.part_no}|${r.workcenter}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "70px", fontSize: "11px", color: "var(--color-text-primary)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.part_no}
            </span>
            <span style={{ width: "90px", fontSize: "10px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.part_type || "—"}
            </span>
            <div style={{ flex: 1, position: "relative", height: "14px", background: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ ...s.barFill, width: `${(r.scrap_qty / maxQty) * 100}%`, background: barColor, opacity: 0.8 }} />
            </div>
            <span style={{ width: "38px", fontSize: "11px", color: "var(--color-text-primary)", textAlign: "right", fontWeight: 600 }}>{r.scrap_qty}</span>
            <span style={{ width: "52px", fontSize: "10px", color: "var(--color-text-secondary)", textAlign: "right" }}>{fmtCurrency(r.scrap_cost)}</span>
          </div>
        );
      })}
      <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)", marginTop: "2px" }}>
        color = severidad de costo relativo
      </div>
    </div>
  );
}

// ── Detail Table ──────────────────────────────────────────────────────────────

function DetailTable({ data, lang }: { data: WCRow[]; lang: "es" | "en" }) {
  const l = lang === "es";
  const buColors: Record<string, React.CSSProperties> = {
    volvo:   { background: "#dbeafe", color: "#1d4ed8" },
    cummins: { background: "#dcfce7", color: "#15803d" },
    tulc:    { background: "#fef9c3", color: "#92400e" },
  };

  return (
    <div style={{ overflowX: "auto" as const }}>
      <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
            {["BU", "Workcenter", l ? "Producción" : "Production", "Scrap", "Yield",
              l ? "Turno A" : "Shift A", l ? "Turno B" : "Shift B", l ? "Costo" : "Cost"].map((h) => (
              <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, fontSize: "0.7rem", letterSpacing: "0.04em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.workcenter} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td style={{ padding: "0.5rem 0.75rem" }}>
                <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, ...(buColors[r.bu] ?? {}) }}>
                  {r.bu.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-primary)" }}>{r.workcenter}</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-primary)" }}>{r.production.toLocaleString()}</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-primary)" }}>{r.scrap_qty.toLocaleString()}</td>
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: semaphore(r.yield_pct, 95) }}>
                {r.yield_pct.toFixed(1)}%
              </td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-secondary)" }}>{r.shift_a.scrap_qty}</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-secondary)" }}>{r.shift_b.scrap_qty}</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-secondary)" }}>{fmtCurrency(r.scrap_cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Modal Metas ───────────────────────────────────────────────────────────────

function TargetsModal({ targets, onClose, onSaved, lang }: {
  targets: QualityTarget[];
  onClose: () => void;
  onSaved: () => void;
  lang: "es" | "en";
}) {
  const l = lang === "es";
  const [rows, setRows]     = useState<QualityTarget[]>(targets);
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows((prev) => [...prev, {
    id: -Date.now(), level: "bu", bu: "volvo", workcenter_name: null,
    yield_min_pct: "95.00", scrap_max_pct: "2.00", updated_at: "",
  } as unknown as QualityTarget]);

  const removeRow = async (t: QualityTarget) => {
    if (t.id > 0) await QualityService.deleteTarget(t.id);
    setRows((prev) => prev.filter((r) => r.id !== t.id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        const payload = {
          level: row.level, bu: row.bu, workcenter_name: row.workcenter_name,
          yield_min_pct: row.yield_min_pct, scrap_max_pct: row.scrap_max_pct,
        };
        if (row.id > 0) await QualityService.updateTarget(row.id, payload);
        else            await QualityService.saveTarget(payload as any);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              {l ? "Configurar metas de calidad" : "Configure quality targets"}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: "2px" }}>
              {l ? "Prioridad: workcenter → BU → default (95% / 2%)" : "Priority: workcenter → BU → default (95% / 2%)"}
            </div>
          </div>
          <button style={{ ...s.btnIcon, border: "none" }} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 80px 80px 32px", gap: "6px", marginBottom: "4px" }}>
            {[l ? "Nivel" : "Level", "BU", "Workcenter", "Yield ≥", "Scrap ≤", ""].map((h) => (
              <span key={h} style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const }}>{h}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 80px 80px 32px", gap: "6px", alignItems: "center" }}>
              <select value={row.level} style={s.select}
                onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, level: e.target.value as any } : r))}>
                <option value="bu">BU</option>
                <option value="workcenter">WC</option>
              </select>
              <select value={row.bu ?? ""} style={s.select}
                onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, bu: e.target.value } : r))}>
                <option value="volvo">Volvo</option>
                <option value="cummins">Cummins</option>
                <option value="tulc">TULC</option>
              </select>
              <input value={row.workcenter_name ?? ""} placeholder="HM Ensamble Final 2" style={s.input}
                onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, workcenter_name: e.target.value || null } : r))} />
              <input type="number" value={row.yield_min_pct} style={s.input} step="0.5" min="0" max="100"
                onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, yield_min_pct: e.target.value } : r))} />
              <input type="number" value={row.scrap_max_pct} style={s.input} step="0.1" min="0" max="100"
                onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, scrap_max_pct: e.target.value } : r))} />
              <button style={{ ...s.btnIcon, padding: "4px", color: "#ef4444" }} onClick={() => removeRow(row)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={s.btnIcon} onClick={addRow}>
            <Plus size={14} /> {l ? "Agregar meta" : "Add target"}
          </button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button style={s.btnIcon} onClick={onClose}>{l ? "Cancelar" : "Cancel"}</button>
            <button
              style={{ ...s.btnIcon, background: "#3b82f6", color: "#fff", border: "none", fontWeight: 600 }}
              onClick={handleSave} disabled={saving}
            >
              {saving ? (l ? "Guardando..." : "Saving...") : (l ? "Guardar" : "Save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function QualityDashboard() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const l    = lang === "es";

  const [startDate, setStartDate] = useState(startOfMonth());
  const [endDate,   setEndDate]   = useState(todayStr());
  const [buFilter,  setBuFilter]  = useState<BUFilter>("all");
  const [topN,      setTopN]      = useState(5);
  const [useShift,  setUseShift]  = useState(true);
  const [data,      setData]      = useState<ScrapData | null>(null);
  const [targets,   setTargets]   = useState<QualityTarget[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadTargets = useCallback(async () => {
    try { setTargets(await QualityService.getTargets()); } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await QualityService.getScrapDetail({ start_date: startDate, end_date: endDate, use_shift: useShift });
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || (l ? "Error cargando datos" : "Error loading data"));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, useShift, l]);

  useEffect(() => { load(); loadTargets(); }, [load, loadTargets]);

  const wcData   = data ? (buFilter === "all" ? data.by_workcenter : data.by_workcenter.filter((r) => r.bu === buFilter)) : [];
  const partData = data ? (buFilter === "all" ? data.by_part       : data.by_part.filter((r) => r.bu === buFilter))       : [];

  const yieldPct  = data?.summary.yield_pct  ?? 0;
  const totalQty  = data?.summary.total_qty  ?? 0;
  const totalCost = data?.summary.total_cost ?? 0;
  const topDefect = data?.by_reason[0]?.scrap_reason ?? "—";

  return (
    <div style={s.page}>

      {/* HEADER */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{l ? "Dashboard de Calidad" : "Quality Dashboard"}</h1>
          <p style={s.subtitle}>Out Tijuana</p>
        </div>
        <div style={s.filterBar}>
          <span style={s.filterLabel}>{l ? "Desde:" : "From:"}</span>
          <input type="date" value={startDate} max={endDate} style={s.input}
            onChange={(e) => setStartDate(e.target.value)} />
          <span style={s.filterLabel}>{l ? "Hasta:" : "To:"}</span>
          <input type="date" value={endDate} max={todayStr()} style={s.input}
            onChange={(e) => setEndDate(e.target.value)} />
          <select value={buFilter} style={s.select} onChange={(e) => setBuFilter(e.target.value as BUFilter)}>
            <option value="all">{l ? "Todos los BU" : "All BU"}</option>
            <option value="volvo">Volvo</option>
            <option value="cummins">Cummins</option>
            <option value="tulc">TULC</option>
          </select>
          <select value={topN} style={s.select} onChange={(e) => setTopN(Number(e.target.value))}>
            <option value={5}>Top 5</option>
            <option value={8}>Top 8</option>
            <option value={10}>Top 10</option>
          </select>
          <select value={useShift ? "shift" : "calendar"} style={s.select}
            onChange={(e) => setUseShift(e.target.value === "shift")}>
            <option value="shift">{l ? "Turno 6AM-6AM" : "Shift 6AM-6AM"}</option>
            <option value="calendar">{l ? "Día calendario" : "Calendar day"}</option>
          </select>
          <button style={s.btnIcon} onClick={() => setModalOpen(true)}>
            <Settings size={14} /> {l ? "Metas" : "Targets"}
          </button>
        </div>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {loading ? (
        <div style={s.loading}>{l ? "Cargando datos Plex..." : "Loading Plex data..."}</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={s.kpiGrid}>
            <KPICard
              label={l ? "Yield FPY" : "FPY Yield"}
              value={`${yieldPct.toFixed(1)}%`}
              sub={`Meta: ${QualityService.resolveTarget(targets, "all", "").yield_min_pct}%`}
              color={semaphore(yieldPct, QualityService.resolveTarget(targets, "all", "").yield_min_pct)}
            />
            <KPICard
              label="Scrap qty"
              value={totalQty.toLocaleString() + " pcs"}
              sub={l ? "Total del período" : "Period total"}
              color={totalQty > 0 ? "#ef4444" : "#10b981"}
            />
            <KPICard
              label={l ? "Costo scrap" : "Scrap cost"}
              value={fmtCurrency(totalCost)}
              sub={`COGP %: ${data && data.summary.total_qty > 0 ? (data.summary.total_cost / data.summary.total_qty).toFixed(2) : "0.00"}`}
              color={semaphore(totalCost, 10000, true)}
            />
            <KPICard
              label={l ? "Top defecto" : "Top defect"}
              value={topDefect.length > 18 ? topDefect.slice(0, 18) + "…" : topDefect}
              sub={`${data?.by_reason[0]?.total_qty ?? 0} pcs · ${data?.by_reason[0]?.pct_of_total.toFixed(0) ?? 0}% del total`}
              color="var(--color-text-primary)"
            />
          </div>

          {/* TOP PARTS + SCRAP TREND */}
          <div style={s.row2}>
            <div style={s.card}>
              <div style={s.cardTitle}>{l ? `Top ${topN} partes con más scrap` : `Top ${topN} parts by scrap`}</div>
              <TopParts data={partData} topN={topN} />
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>{l ? "Scrap por BU" : "Scrap by BU"}</div>
              <BUBars data={data?.by_workcenter ?? []} />
            </div>
          </div>

          {/* TENDENCIA SCRAP + TENDENCIA YIELD */}
          <div style={s.row2eq}>
            <div style={s.card}>
              <div style={s.cardTitle}>{l ? "Tendencia de scrap — qty diaria" : "Scrap trend — daily qty"}</div>
              <TrendScrapChart data={data?.trend ?? []} lang={lang} />
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>{l ? "Tendencia de yield — FPY diario" : "Yield trend — daily FPY"}</div>
              <TrendYieldChart data={data?.trend ?? []} lang={lang} targets={targets} />
            </div>
          </div>

          {/* PARETO + YIELD WC */}
          <div style={s.row75}>
            <div style={s.card}>
              <div style={s.cardTitle}>{l ? `Pareto de defectos — top ${topN}` : `Defect pareto — top ${topN}`}</div>
              <ParetoChart data={data?.by_reason ?? []} topN={topN} />
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>{l ? "Yield por workcenter" : "Yield by workcenter"}</div>
              <YieldByWC data={wcData} targets={targets} />
            </div>
          </div>

          {/* HEATMAP */}
          <div style={s.card}>
            <div style={s.cardTitle}>{l ? "Heatmap — turno × workcenter" : "Heatmap — shift × workcenter"}</div>
            <Heatmap data={data?.by_shift ?? []} />
          </div>

          {/* TABLA DETALLE */}
          <div style={s.card}>
            <div style={s.cardTitle}>{l ? "Detalle por workcenter" : "Workcenter detail"}</div>
            <DetailTable data={wcData} lang={lang} />
          </div>
        </>
      )}

      {/* MODAL METAS */}
      {modalOpen && (
        <TargetsModal
          targets={targets}
          onClose={() => setModalOpen(false)}
          onSaved={loadTargets}
          lang={lang}
        />
      )}
    </div>
  );
}