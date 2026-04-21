// apps/frontend/src/modules/quality/QualityPanelPage.tsx

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Settings, X, Plus, Trash2, Maximize2, Info } from "lucide-react";
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

const todayStr     = () => new Date().toISOString().slice(0, 10);
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

// ── Expand Modal ──────────────────────────────────────────────────────────────

function ExpandModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "1100px", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Panel Card ────────────────────────────────────────────────────────────────

function PanelCard({ title, info, children, expandContent }: {
  title: string; info?: string; children: React.ReactNode; expandContent?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.625rem 0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            {title}
          </span>
          <div style={{ display: "flex", gap: "3px" }}>
            {info && (
              <div style={{ position: "relative" }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex", padding: "2px" }}
                  onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)}>
                  <Info size={12} />
                </button>
                {showInfo && (
                  <div style={{ position: "absolute", right: 0, top: "18px", zIndex: 200, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", fontSize: "11px", color: "var(--color-text-secondary)", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", maxWidth: "220px", whiteSpace: "normal" as any }}>
                    {info}
                  </div>
                )}
              </div>
            )}
            {expandContent && (
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex", padding: "2px" }}
                onClick={() => setExpanded(true)}>
                <Maximize2 size={12} />
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
      </div>
      {expanded && expandContent && (
        <ExpandModal title={title} onClose={() => setExpanded(false)}>{expandContent}</ExpandModal>
      )}
    </>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color, info }: { label: string; value: string; sub: string; color: string; info?: string }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "0.625rem 0.875rem", display: "flex", flexDirection: "column", gap: "0.2rem", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</span>
        {info && (
          <div style={{ position: "relative" }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex", padding: "2px" }}
              onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)}>
              <Info size={11} />
            </button>
            {showInfo && (
              <div style={{ position: "absolute", right: 0, top: "16px", zIndex: 200, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", fontSize: "11px", color: "var(--color-text-secondary)", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", maxWidth: "200px", whiteSpace: "normal" as any }}>
                {info}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "var(--color-text-tertiary)" }}>{sub}</div>
    </div>
  );
}

// ── Mini Line Chart ───────────────────────────────────────────────────────────

interface MiniLineProps {
  data: { value: number; label: string; extra?: string }[];
  color: string;
  yMin?: number;
  yMax: number;
  yFormat?: (v: number) => string;
  refLine?: number;
  height?: number;
}

function MiniLineChart({ data, color, yMin = 0, yMax, yFormat, refLine, height = 90 }: MiniLineProps) {
  const [hover, setHover] = useState<{ idx: number } | null>(null);
  if (!data.length) return <div style={{ color: "var(--color-text-tertiary)", fontSize: "10px", textAlign: "center", paddingTop: "1rem" }}>Sin datos</div>;

  const W = 500; const H = height;
  const PAD = { top: 12, right: 8, bottom: 20, left: 32 };
  const iW  = W - PAD.left - PAD.right;
  const iH  = H - PAD.top - PAD.bottom;
  const range = yMax - yMin || 1;
  const n     = data.length;

  const xPos = (i: number) => PAD.left + (n === 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yPos = (v: number) => PAD.top + iH - ((v - yMin) / range) * iH;

  const pts     = data.map((d, i) => ({ x: xPos(i), y: yPos(d.value), ...d }));
  const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPts = [`${pts[0].x},${PAD.top + iH}`, ...pts.map((p) => `${p.x},${p.y}`), `${pts[pts.length - 1].x},${PAD.top + iH}`].join(" ");

  const step    = Math.max(1, Math.ceil(n / 5));
  const xLabels = pts.filter((_, i) => i % step === 0 || i === n - 1);
  const yTicks  = [0, 0.5, 1].map((pct) => ({ value: yMin + range * pct, y: yPos(yMin + range * pct) }));
  const fmt     = yFormat ?? ((v: number) => String(Math.round(v)));
  const hovered = hover !== null ? pts[hover.idx] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}>
        {yTicks.map((t) => (
          <g key={t.value}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + iW} y2={t.y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={PAD.left - 4} y={t.y + 3} fontSize="8" fill="var(--color-text-tertiary)" textAnchor="end">{fmt(t.value)}</text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top + iH} x2={PAD.left + iW} y2={PAD.top + iH} stroke="var(--color-border)" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + iH} stroke="var(--color-border)" strokeWidth="1" />
        {refLine !== undefined && (
          <line x1={PAD.left} y1={yPos(refLine)} x2={PAD.left + iW} y2={yPos(refLine)} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
        )}
        <polygon points={areaPts} fill={color} opacity="0.08" />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {hovered && <line x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={PAD.top + iH} stroke={color} strokeWidth="1" strokeDasharray="3,2" opacity="0.5" />}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={10} fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHover({ idx: i })} />
            <circle cx={p.x} cy={p.y} r={hover?.idx === i ? 4 : 2.5} fill={hover?.idx === i ? "#fff" : color} stroke={color} strokeWidth="1.5" />
          </g>
        ))}
        {xLabels.map((p, i) => (
          <text key={i} x={p.x} y={PAD.top + iH + 13} fontSize="8" fill="var(--color-text-tertiary)" textAnchor="middle">{p.label}</text>
        ))}
      </svg>
      {hovered && (
        <div style={{ position: "absolute", left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`, transform: "translate(-50%, -115%)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.3rem 0.5rem", fontSize: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10 }}>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{hovered.label}</div>
          <div style={{ color }}>{fmt(hovered.value)}</div>
          {hovered.extra && <div style={{ color: "var(--color-text-tertiary)", marginTop: "1px" }}>{hovered.extra}</div>}
        </div>
      )}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "center", height: "100%", paddingTop: "0.25rem" }}>
      {(["volvo", "cummins", "tulc"] as const).map((b) => {
        const pct = total > 0 ? (bu[b] / total) * 100 : 0;
        return (
          <div key={b}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{labels[b]}</span>
              <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{bu[b].toLocaleString()} · {pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: "8px", background: "var(--color-border)", borderRadius: "3px" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: colors[b], borderRadius: "3px" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Pareto mini ───────────────────────────────────────────────────────────────

function ParetoMini({ data }: { data: ReasonRow[] }) {
  const rows   = data.slice(0, 10);
  const maxQty = rows[0]?.total_qty ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {rows.map((r) => {
        const cumColor = r.cumulative_pct <= 50 ? "#ef4444" : r.cumulative_pct <= 80 ? "#f59e0b" : "#10b981";
        return (
          <div key={r.scrap_reason} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "110px", fontSize: "9px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "right" }}>
              {r.scrap_reason}
            </span>
            <div style={{ flex: 1, position: "relative", height: "12px", background: "var(--color-border)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ position: "absolute", height: "100%", width: `${(r.total_qty / maxQty) * 100}%`, background: cumColor, opacity: 0.8, borderRadius: "2px" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "80%", width: "1.5px", background: "#f59e0b" }} />
            </div>
            <span style={{ width: "28px", fontSize: "9px", color: "var(--color-text-primary)", textAlign: "right", fontWeight: 600 }}>{r.total_qty}</span>
            <span style={{ width: "28px", fontSize: "9px", color: cumColor, textAlign: "right", fontWeight: 700 }}>{r.cumulative_pct.toFixed(0)}%</span>
          </div>
        );
      })}
      <div style={{ fontSize: "8px", color: "#f59e0b", marginTop: "2px" }}>— línea = umbral 80%</div>
    </div>
  );
}

// ── Pareto expandido ──────────────────────────────────────────────────────────

function ParetoExpanded({ data }: { data: ReasonRow[] }) {
  const rows   = data.slice(0, 10);
  const maxQty = rows[0]?.total_qty ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "200px", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "80%", height: "1.5px", background: "#f59e0b", opacity: 0.8 }} />
        {rows.map((r) => {
          const heightPct = (r.total_qty / maxQty) * 100;
          const cumColor  = r.cumulative_pct <= 50 ? "#ef4444" : r.cumulative_pct <= 80 ? "#f59e0b" : "#10b981";
          return (
            <div key={r.scrap_reason} title={`${r.scrap_reason}\n${r.total_qty} pcs — ${r.cumulative_pct.toFixed(0)}% acum`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <span style={{ fontSize: "9px", color: cumColor, fontWeight: 700, marginBottom: "2px" }}>{r.cumulative_pct.toFixed(0)}%</span>
              <div style={{ width: "100%", height: `${heightPct}%`, background: cumColor, borderRadius: "3px 3px 0 0", minHeight: "4px", opacity: 0.85 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "4px", height: "52px", overflow: "hidden" }}>
        {rows.map((r) => (
          <div key={r.scrap_reason} style={{ flex: 1, overflow: "hidden" }}>
            <span style={{ display: "block", fontSize: "9px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", transform: "rotate(-35deg)", transformOrigin: "left top", marginTop: "4px", marginLeft: "4px" }}>
              {r.scrap_reason}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {rows.map((r) => (
          <div key={r.scrap_reason} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span style={{ color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{r.scrap_reason}</span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.total_qty} pcs · {r.pct_of_total.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Yield por WC ──────────────────────────────────────────────────────────────

function YieldByWC({ data, targets, compact = false }: { data: WCRow[]; targets: QualityTarget[]; compact?: boolean }) {
  const fs   = compact ? "9px"  : "11px";
  const barH = compact ? "10px" : "16px";
  const w    = compact ? "90px" : "130px";

  const rows = compact ? data.slice(0, 10) : data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? "4px" : "8px" }}>
      {rows.map((r) => {
        const meta  = QualityService.resolveTarget(targets, r.bu, r.workcenter);
        const color = semaphore(r.yield_pct, meta.yield_min_pct);
        return (
          <div key={r.workcenter} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: w, fontSize: fs, color: "var(--color-text-secondary)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.workcenter}
            </span>
            <div style={{ flex: 1, position: "relative", height: barH, background: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ position: "absolute", height: "100%", width: `${r.yield_pct}%`, background: color, transition: "width 0.4s ease" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${meta.yield_min_pct}%`, width: "1.5px", background: "#ef4444", opacity: 0.7 }} />
            </div>
            <span style={{ width: "36px", fontSize: fs, color, fontWeight: 700, textAlign: "right" }}>{r.yield_pct.toFixed(1)}%</span>
          </div>
        );
      })}
      <div style={{ fontSize: "8px", color: "#ef4444", opacity: 0.7 }}>— línea roja = meta</div>
    </div>
  );
}

// ── Top Parts mini ────────────────────────────────────────────────────────────

function TopPartsMini({ data }: { data: PartRow[] }) {
  const rows    = data.slice(0, 10);
  const maxQty  = rows[0]?.scrap_qty ?? 1;
  const maxCost = Math.max(...rows.map((r) => r.scrap_cost), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", gap: "5px", fontSize: "8px", color: "var(--color-text-tertiary)", paddingBottom: "3px", borderBottom: "1px solid var(--color-border)" }}>
        <span style={{ width: "55px" }}>Part No</span>
        <span style={{ width: "70px" }}>Type</span>
        <span style={{ flex: 1 }}>qty</span>
        <span style={{ width: "30px", textAlign: "right" }}>pcs</span>
        <span style={{ width: "44px", textAlign: "right" }}>costo</span>
      </div>
      {rows.map((r) => {
        const costSeverity = r.scrap_cost / maxCost;
        const barColor = costSeverity > 0.6 ? "#ef4444" : costSeverity > 0.3 ? "#f59e0b" : "#3b82f6";
        return (
          <div key={`${r.part_no}|${r.workcenter}`} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "55px", fontSize: "9px", color: "var(--color-text-primary)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.part_no}</span>
            <span style={{ width: "70px", fontSize: "8px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.part_type || "—"}</span>
            <div style={{ flex: 1, position: "relative", height: "10px", background: "var(--color-border)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ position: "absolute", height: "100%", width: `${(r.scrap_qty / maxQty) * 100}%`, background: barColor, opacity: 0.8 }} />
            </div>
            <span style={{ width: "30px", fontSize: "9px", color: "var(--color-text-primary)", textAlign: "right", fontWeight: 600 }}>{r.scrap_qty}</span>
            <span style={{ width: "44px", fontSize: "8px", color: "var(--color-text-secondary)", textAlign: "right" }}>{fmtCurrency(r.scrap_cost)}</span>
          </div>
        );
      })}
    </div>
  );
}

function TopPartsExpanded({ data }: { data: PartRow[] }) {
  const rows    = data.slice(0, 10);
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
            <span style={{ width: "70px", fontSize: "11px", color: "var(--color-text-primary)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.part_no}</span>
            <span style={{ width: "90px", fontSize: "10px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.part_type || "—"}</span>
            <div style={{ flex: 1, position: "relative", height: "14px", background: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ position: "absolute", height: "100%", width: `${(r.scrap_qty / maxQty) * 100}%`, background: barColor, opacity: 0.8 }} />
            </div>
            <span style={{ width: "38px", fontSize: "11px", color: "var(--color-text-primary)", textAlign: "right", fontWeight: 600 }}>{r.scrap_qty}</span>
            <span style={{ width: "52px", fontSize: "10px", color: "var(--color-text-secondary)", textAlign: "right" }}>{fmtCurrency(r.scrap_cost)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ data, compact = false }: { data: ShiftRow[]; compact?: boolean }) {
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

  const cellH  = compact ? "18px" : "24px";
  const labelW = compact ? "80px" : "100px";
  const fs     = compact ? "9px"  : "10px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ display: "flex", gap: "3px", marginBottom: "2px" }}>
        <span style={{ width: labelW }} />
        {["A", "B"].map((sh) => (
          <span key={sh} style={{ flex: 1, textAlign: "center", fontSize: fs, fontWeight: 700, color: "var(--color-text-secondary)" }}>
            {sh === "A" ? "Turno A (6AM-6PM)" : "Turno B (6PM-6AM)"}
          </span>
        ))}
      </div>
      {wcs.map((wc) => (
        <div key={wc} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span style={{ width: labelW, fontSize: fs, color: "var(--color-text-secondary)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {wc}
          </span>
          {["A", "B"].map((sh) => {
            const qty = getQty(wc, sh);
            return (
              <div key={sh} style={{ flex: 1, height: cellH, borderRadius: "3px", background: cellColor(qty), display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs, fontWeight: 600, color: textColor(qty) }}>
                {qty || "—"}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
        <span style={{ fontSize: "8px", color: "var(--color-text-tertiary)" }}>bajo</span>
        {["#dcfce7", "#fef9c3", "#fee2e2", "#fca5a5"].map((c) => (
          <div key={c} style={{ width: "12px", height: "6px", borderRadius: "2px", background: c }} />
        ))}
        <span style={{ fontSize: "8px", color: "var(--color-text-tertiary)" }}>alto</span>
      </div>
    </div>
  );
}

// ── WC Summary + Modal ────────────────────────────────────────────────────────

function WCSummary({ data, lang, onExpand }: { data: WCRow[]; lang: "es" | "en"; onExpand: () => void }) {
  const buColors: Record<string, React.CSSProperties> = {
    volvo:   { background: "#dbeafe", color: "#1d4ed8" },
    cummins: { background: "#dcfce7", color: "#15803d" },
    tulc:    { background: "#fef9c3", color: "#92400e" },
  };

  const top5 = [...data].sort((a, b) => a.yield_pct - b.yield_pct).slice(0, 13);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ display: "flex", gap: "4px", fontSize: "8px", color: "var(--color-text-tertiary)", paddingBottom: "3px", borderBottom: "1px solid var(--color-border)" }}>
        <span style={{ width: "36px" }}>BU</span>
        <span style={{ flex: 1 }}>Workcenter</span>
        <span style={{ width: "32px", textAlign: "right" }}>Prod</span>
        <span style={{ width: "32px", textAlign: "right" }}>Scrap</span>
        <span style={{ width: "38px", textAlign: "right" }}>Yield</span>
      </div>
      {top5.map((r) => (
        <div key={r.workcenter} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "36px" }}>
            <span style={{ padding: "1px 4px", borderRadius: "8px", fontSize: "8px", fontWeight: 600, ...(buColors[r.bu] ?? {}) }}>
              {r.bu.slice(0, 3).toUpperCase()}
            </span>
          </span>
          <span style={{ flex: 1, fontSize: "9px", color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.workcenter}</span>
          <span style={{ width: "32px", fontSize: "9px", color: "var(--color-text-secondary)", textAlign: "right" }}>{r.production.toLocaleString()}</span>
          <span style={{ width: "32px", fontSize: "9px", color: "var(--color-text-primary)", fontWeight: 600, textAlign: "right" }}>{r.scrap_qty}</span>
          <span style={{ width: "38px", fontSize: "9px", fontWeight: 700, color: semaphore(r.yield_pct, 95), textAlign: "right" }}>{r.yield_pct.toFixed(1)}%</span>
        </div>
      ))}
      <button onClick={onExpand} style={{ marginTop: "4px", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "3px 8px", fontSize: "9px", color: "var(--color-text-secondary)", cursor: "pointer", alignSelf: "flex-end" }}>
        {lang === "es" ? `Ver todos (${data.length})` : `View all (${data.length})`}
      </button>
    </div>
  );
}

function WCDetailModal({ data, lang, onClose }: { data: WCRow[]; lang: "es" | "en"; onClose: () => void }) {
  const l = lang === "es";
  const buColors: Record<string, React.CSSProperties> = {
    volvo:   { background: "#dbeafe", color: "#1d4ed8" },
    cummins: { background: "#dcfce7", color: "#15803d" },
    tulc:    { background: "#fef9c3", color: "#92400e" },
  };

  return (
    <ExpandModal title={l ? "Detalle por workcenter" : "Workcenter detail"} onClose={onClose}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              {["BU", "Workcenter", l ? "Producción" : "Production", "Scrap", "Yield",
                l ? "Turno A" : "Shift A", l ? "Turno B" : "Shift B", l ? "Costo" : "Cost"].map((h) => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, fontSize: "0.7rem", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
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
                <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-primary)", fontWeight: 600 }}>{r.scrap_qty.toLocaleString()}</td>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: semaphore(r.yield_pct, 95) }}>{r.yield_pct.toFixed(1)}%</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-secondary)" }}>{r.shift_a.scrap_qty}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-secondary)" }}>{r.shift_b.scrap_qty}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{fmtCurrency(r.scrap_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ExpandModal>
  );
}

// ── Targets Modal ─────────────────────────────────────────────────────────────

function TargetsModal({ targets, onClose, onSaved, lang }: {
  targets: QualityTarget[]; onClose: () => void; onSaved: () => void; lang: "es" | "en";
}) {
  const l = lang === "es";
  const [rows, setRows]     = useState<QualityTarget[]>(targets);
  const [saving, setSaving] = useState(false);
  const inp = { padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" };
  const btn = { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.8125rem" };

  const addRow    = () => setRows((p) => [...p, { id: -Date.now(), level: "bu", bu: "volvo", workcenter_name: null, yield_min_pct: "95.00", scrap_max_pct: "2.00", updated_at: "" } as unknown as QualityTarget]);
  const removeRow = async (t: QualityTarget) => { if (t.id > 0) await QualityService.deleteTarget(t.id); setRows((p) => p.filter((r) => r.id !== t.id)); };
  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        const payload = { level: row.level, bu: row.bu, workcenter_name: row.workcenter_name, yield_min_pct: row.yield_min_pct, scrap_max_pct: row.scrap_max_pct };
        if (row.id > 0) await QualityService.updateTarget(row.id, payload);
        else            await QualityService.saveTarget(payload as any);
      }
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl, 16px)", padding: "2rem", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{l ? "Configurar metas de calidad" : "Configure quality targets"}</div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: "2px" }}>{l ? "Prioridad: workcenter → BU → default (95% / 2%)" : "Priority: workcenter → BU → default (95% / 2%)"}</div>
          </div>
          <button style={{ ...btn, border: "none" }} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 80px 80px 32px", gap: "6px", marginBottom: "4px" }}>
            {[l ? "Nivel" : "Level", "BU", "Workcenter", "Yield ≥", "Scrap ≤", ""].map((h) => (
              <span key={h} style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const }}>{h}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 80px 80px 32px", gap: "6px", alignItems: "center" }}>
              <select value={row.level} style={inp} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, level: e.target.value as any } : r))}>
                <option value="bu">BU</option><option value="workcenter">WC</option>
              </select>
              <select value={row.bu ?? ""} style={inp} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, bu: e.target.value } : r))}>
                <option value="volvo">Volvo</option><option value="cummins">Cummins</option><option value="tulc">TULC</option>
              </select>
              <input value={row.workcenter_name ?? ""} placeholder="HM Ensamble Final 2" style={inp} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, workcenter_name: e.target.value || null } : r))} />
              <input type="number" value={row.yield_min_pct} style={inp} step="0.5" min="0" max="100" onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, yield_min_pct: e.target.value } : r))} />
              <input type="number" value={row.scrap_max_pct} style={inp} step="0.1" min="0" max="100" onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, scrap_max_pct: e.target.value } : r))} />
              <button style={{ ...btn, padding: "4px", color: "#ef4444" }} onClick={() => removeRow(row)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={btn} onClick={addRow}><Plus size={14} /> {l ? "Agregar meta" : "Add target"}</button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button style={btn} onClick={onClose}>{l ? "Cancelar" : "Cancel"}</button>
            <button style={{ ...btn, background: "#3b82f6", color: "#fff", border: "none", fontWeight: 600 }} onClick={handleSave} disabled={saving}>
              {saving ? (l ? "Guardando..." : "Saving...") : (l ? "Guardar" : "Save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function QualityPanelPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const l    = lang === "es";

  const [startDate,   setStartDate]   = useState(startOfMonth());
  const [endDate,     setEndDate]     = useState(todayStr());
  const [buFilter,    setBuFilter]    = useState<BUFilter>("all");
  const [useShift,    setUseShift]    = useState(true);
  const [data,        setData]        = useState<ScrapData | null>(null);
  const [targets,     setTargets]     = useState<QualityTarget[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [wcModalOpen, setWcModalOpen] = useState(false);

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
    } finally { setLoading(false); }
  }, [startDate, endDate, useShift, l]);

  useEffect(() => { load(); loadTargets(); }, [load, loadTargets]);

  const wcData   = data ? (buFilter === "all" ? data.by_workcenter : data.by_workcenter.filter((r) => r.bu === buFilter)) : [];
  const partData = data ? (buFilter === "all" ? data.by_part       : data.by_part.filter((r) => r.bu === buFilter))       : [];

  const yieldPct     = data?.summary.yield_pct  ?? 0;
  const totalQty     = data?.summary.total_qty  ?? 0;
  const totalCost    = data?.summary.total_cost ?? 0;
  const topDefect    = data?.by_reason[0]?.scrap_reason ?? "—";
  const topDefectQty = data?.by_reason[0]?.total_qty ?? 0;
  const meta         = QualityService.resolveTarget(targets, "all", "").yield_min_pct;

  const scrapPoints = (data?.trend ?? []).map((d) => ({
    value: d.total_qty, label: d.date.slice(5),
    extra: `${fmtCurrency(d.total_cost)} · V:${d.volvo_qty} C:${d.cummins_qty} T:${d.tulc_qty}`,
  }));
  const yieldPoints = (data?.trend ?? []).map((d) => ({
    value: d.yield_pct ?? 100, label: d.date.slice(5),
    extra: `Prod: ${(d.production ?? 0).toLocaleString()} · Scrap: ${d.total_qty}`,
  }));

  const inp = { padding: "0.3rem 0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.78rem" };
  const btn = { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.3rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.78rem" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            {l ? "Panel Operativo — Calidad" : "Operational Panel — Quality"}
          </h1>
          <p style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", margin: "1px 0 0" }}>Out Tijuana</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>{l ? "Desde:" : "From:"}</span>
          <input type="date" value={startDate} max={endDate} style={inp} onChange={(e) => setStartDate(e.target.value)} />
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>{l ? "Hasta:" : "To:"}</span>
          <input type="date" value={endDate} max={todayStr()} style={inp} onChange={(e) => setEndDate(e.target.value)} />
          <select value={buFilter} style={inp} onChange={(e) => setBuFilter(e.target.value as BUFilter)}>
            <option value="all">{l ? "Todos los BU" : "All BU"}</option>
            <option value="volvo">Volvo</option>
            <option value="cummins">Cummins</option>
            <option value="tulc">TULC</option>
          </select>
          <select value={useShift ? "shift" : "calendar"} style={inp} onChange={(e) => setUseShift(e.target.value === "shift")}>
            <option value="shift">{l ? "Turno 6AM-6AM" : "Shift 6AM-6AM"}</option>
            <option value="calendar">{l ? "Día calendario" : "Calendar day"}</option>
          </select>
          <button style={btn} onClick={() => setModalOpen(true)}><Settings size={12} /> {l ? "Metas" : "Targets"}</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "0.4rem 0.75rem", color: "#b91c1c", fontSize: "0.78rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          {l ? "Cargando datos Plex..." : "Loading Plex data..."}
        </div>
      ) : (
        <>
          {/* FILA 1 — KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
            <KPICard
              label={l ? "Yield FPY" : "FPY Yield"}
              value={`${yieldPct.toFixed(1)}%`}
              sub={`Meta: ${meta}%`}
              color={semaphore(yieldPct, meta)}
              info={l ? "First Pass Yield — piezas buenas sobre total producido + scrapeado" : "First Pass Yield — good parts over total produced + scrapped"}
            />
            <KPICard
              label="Scrap qty"
              value={totalQty.toLocaleString() + " pcs"}
              sub={l ? "Total del período" : "Period total"}
              color={totalQty > 0 ? "#ef4444" : "#10b981"}
              info={l ? "Total piezas scrapeadas en el rango seleccionado" : "Total scrapped parts in selected range"}
            />
            <KPICard
              label={l ? "Costo scrap" : "Scrap cost"}
              value={fmtCurrency(totalCost)}
              sub={`$/pcs: ${totalQty > 0 ? (totalCost / totalQty).toFixed(2) : "0.00"}`}
              color={semaphore(totalCost, 10000, true)}
              info={l ? "Costo extendido del scrap. Rojo si supera $10,000" : "Extended scrap cost. Red if over $10,000"}
            />
            <KPICard
              label={l ? "Top defecto" : "Top defect"}
              value={topDefect.length > 16 ? topDefect.slice(0, 16) + "…" : topDefect}
              sub={`${topDefectQty.toLocaleString()} pcs · ${data?.by_reason[0]?.pct_of_total.toFixed(0) ?? 0}% del total`}
              color="var(--color-text-primary)"
              info={l ? "Razón de scrap más frecuente en el período" : "Most frequent scrap reason in the period"}
            />
          </div>

          {/* FILA 2 — Tend. Scrap | Tend. Yield | Scrap por BU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.6fr", gap: "0.5rem" }}>
            <PanelCard
              title={l ? "Tendencia scrap — qty diaria" : "Scrap trend — daily qty"}
              info={l ? "Evolución diaria del scrap total en el período seleccionado" : "Daily scrap quantity evolution in selected period"}
              expandContent={<MiniLineChart data={scrapPoints} color="#3b82f6" yMax={Math.max(...scrapPoints.map((p) => p.value), 1)} height={220} />}
            >
              <MiniLineChart data={scrapPoints} color="#3b82f6" yMax={Math.max(...scrapPoints.map((p) => p.value), 1)} height={90} />
            </PanelCard>

            <PanelCard
              title={l ? "Tendencia yield — FPY diario" : "Yield trend — daily FPY"}
              info={l ? "Evolución diaria del yield FPY. Línea roja = meta mínima configurada" : "Daily FPY yield trend. Red line = configured minimum target"}
              expandContent={<MiniLineChart data={yieldPoints} color="#10b981" yMin={0} yMax={100} yFormat={(v) => `${v.toFixed(0)}%`} refLine={meta} height={220} />}
            >
              <MiniLineChart data={yieldPoints} color="#10b981" yMin={0} yMax={100} yFormat={(v) => `${v.toFixed(0)}%`} refLine={meta} height={90} />
            </PanelCard>

            <PanelCard
              title={l ? "Scrap por BU" : "Scrap by BU"}
              info={l ? "Distribución de scrap entre Volvo, Cummins y TULC" : "Scrap distribution across Volvo, Cummins and TULC"}
              expandContent={<BUBars data={data?.by_workcenter ?? []} />}
            >
              <BUBars data={data?.by_workcenter ?? []} />
            </PanelCard>
          </div>

          {/* FILA 3 — Pareto | Yield WC | Top Parts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
            <PanelCard
              title={l ? "Pareto defectos — top 10" : "Defect pareto — top 10"}
              info={l ? "Razones de scrap por frecuencia. Línea amarilla = umbral 80/20" : "Scrap reasons by frequency. Yellow line = 80/20 threshold"}
              expandContent={<ParetoExpanded data={data?.by_reason ?? []} />}
            >
              <ParetoMini data={data?.by_reason ?? []} />
            </PanelCard>

            <PanelCard
              title={l ? "Yield por workcenter" : "Yield by workcenter"}
              info={l ? "FPY por WC vs meta configurada. Línea roja = mínimo requerido" : "FPY per WC vs configured target. Red line = minimum required"}
              expandContent={<YieldByWC data={wcData} targets={targets} compact={false} />}
            >
              <YieldByWC data={wcData} targets={targets} compact={true} />
            </PanelCard>

            <PanelCard
              title={l ? "Top 10 partes — scrap" : "Top 10 parts — scrap"}
              info={l ? "Partes con mayor scrap. Color de barra = severidad de costo relativo" : "Parts with highest scrap. Bar color = relative cost severity"}
              expandContent={<TopPartsExpanded data={partData} />}
            >
              <TopPartsMini data={partData} />
            </PanelCard>
          </div>

          {/* FILA 4 — Heatmap | WC Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.5rem" }}>
            <PanelCard
              title={l ? "Heatmap — turno × workcenter" : "Heatmap — shift × workcenter"}
              info={l ? "Concentración de scrap por turno. Turno A: 6AM-6PM · Turno B: 6PM-6AM" : "Scrap concentration by shift. Shift A: 6AM-6PM · Shift B: 6PM-6AM"}
              expandContent={<Heatmap data={data?.by_shift ?? []} compact={false} />}
            >
              <Heatmap data={data?.by_shift ?? []} compact={true} />
            </PanelCard>

            <PanelCard
              title={l ? "Resumen workcenter" : "Workcenter summary"}
              info={l ? "Top 5 workcenters con menor yield. Haz clic en 'Ver todos' para ver el detalle completo" : "Top 5 workcenters with lowest yield. Click 'View all' for full detail"}
            >
              <WCSummary data={wcData} lang={lang} onExpand={() => setWcModalOpen(true)} />
            </PanelCard>
          </div>
        </>
      )}

      {modalOpen && (
        <TargetsModal targets={targets} onClose={() => setModalOpen(false)} onSaved={loadTargets} lang={lang} />
      )}
      {wcModalOpen && (
        <WCDetailModal data={wcData} lang={lang} onClose={() => setWcModalOpen(false)} />
      )}
    </div>
  );
}