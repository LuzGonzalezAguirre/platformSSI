import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  QWallService, QWallReport, QWallRow, QWallInspectorRow,
  QWallPartNumber, QWallPartNumberSummary, QWallFailByPointResponse, QWallFailByPointItem,
  QWallBuSummaryItem, QWallPartNumberSummaryResponse,
} from "../services/qwall.service";
import ParetoChart from "./ParetoChart";
import TrendChart from "./TrendChart";

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

// ── Derivar agregados desde subset de rows ────────────────────────────────────

function deriveFromRows(rows: QWallRow[]) {
  const total      = rows.length;
  const pass       = rows.filter(r => r.result === "PASS").length;
  const fail       = total - pass;
  const pass_rate  = total ? (pass / total) * 100 : 0;
  const durs       = rows.map(r => r.duration_seconds).filter(Boolean);
  const avg_duration = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
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

  return {
    summary: { total, pass, fail, pass_rate, avg_duration, part_numbers },
    by_inspector,
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

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "0.35rem 0.5rem", fontWeight: 700,
  color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", color: "var(--color-text-primary)",
  borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
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

const PASS_RATE_TARGET = 95;

// Paleta categórica validada (skill dataviz, orden fijo, luz) — usada para el
// donut de distribución por part number. Un 9° slice nunca genera un hue nuevo:
// se pliega en "Otros" (ver buildDistributionSlices).
const CATEGORICAL_PALETTE = [
  "#2a78d6", "#1baf7a", "#eda100", "#008300",
  "#4a3aa7", "#e34948", "#e87ba4", "#eb6834",
];
const OTHER_SLICE_COLOR = "#898781";
const MAX_DISTRIBUTION_SLICES = 8;

function buildDistributionSlices(items: QWallPartNumberSummary[], otherLabel: string) {
  const sorted = [...items].sort((a, b) => b.inspection_count - a.inspection_count);
  if (sorted.length <= MAX_DISTRIBUTION_SLICES) {
    return sorted.map((it, i) => ({ label: it.part_number, value: it.inspection_count, color: CATEGORICAL_PALETTE[i] }));
  }
  const head  = sorted.slice(0, MAX_DISTRIBUTION_SLICES - 1);
  const rest  = sorted.slice(MAX_DISTRIBUTION_SLICES - 1);
  const other = rest.reduce((sum, it) => sum + it.inspection_count, 0);
  return [
    ...head.map((it, i) => ({ label: it.part_number, value: it.inspection_count, color: CATEGORICAL_PALETTE[i] })),
    { label: otherLabel, value: other, color: OTHER_SLICE_COLOR },
  ];
}

// ── VBarSingle: barras verticales de una sola serie (mismo lenguaje visual que
// VBar — geometría, padding y truncado de labels — pero sin par pass/fail) ──────

function VBarSingle({ data, color = "#8b5cf6" }: { data: { label: string; value: number }[]; color?: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value), 1);
  const W = 480; const H = 120;
  const padL = 8; const padR = 8; const padT = 14; const padB = 30;
  const chartH = H - padT - padB;
  const bw = Math.min(32, (W - padL - padR) / data.length - 4);
  const spacing = (W - padL - padR) / data.length;
  const barX = (i: number) => padL + i * spacing + spacing / 2 - bw / 2;
  const barCenterX = (i: number) => padL + i * spacing + spacing / 2;
  const barTopY = (i: number) => padT + chartH - (data[i].value / max) * chartH;

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {data.map((d, i) => {
          const h = (d.value / max) * chartH;
          const isHov = hoverIdx === i;
          return (
            <g key={d.label}
              onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: "pointer" }}
            >
              <rect x={barX(i)} y={padT + chartH - h} width={bw} height={h} fill={color} opacity={isHov ? 1 : 0.85} rx={2} />
              <text x={barCenterX(i)} y={padT + chartH - h - 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--color-text-primary)">
                {d.value}
              </text>
              <text x={barCenterX(i)} y={H - 4} textAnchor="middle" fontSize={7.5} fill="var(--color-text-secondary)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered && hoverIdx !== null && (
        <div style={{
          position: "absolute",
          left: `${(barCenterX(hoverIdx) / W) * 100}%`,
          top: `${((barTopY(hoverIdx) - 10) / H) * 100}%`,
          transform: "translate(-50%, -100%)",
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "8px", padding: "0.4rem 0.6rem", fontSize: "0.7rem",
          color: "var(--color-text-primary)", pointerEvents: "none", zIndex: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 700 }}>{hovered.label}</div>
          <div>{hovered.value.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

// ── Callout: parte con menor pass rate (no es una gráfica) ─────────────────────

function LowestPassRateCallout({ item }: { item: QWallPartNumberSummary | null }) {
  const { t } = useTranslation();
  if (!item) {
    return <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("qwallDashboard.partNumberSummary.noData")}</p>;
  }
  const color = semaphore(item.pass_rate, PASS_RATE_TARGET);
  return (
    <div style={{ ...card, borderTop: `3px solid ${color}`, padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "0.3rem" }}>
        {item.part_number}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color, lineHeight: 1 }}>
        {item.pass_rate.toFixed(1)}%
      </div>
      <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginTop: "0.375rem" }}>
        {item.inspection_count} {t("qwallDashboard.partNumberSummary.columns.inspections")} · {item.run_count} {t("qwallDashboard.partNumberSummary.columns.runs")}
      </div>
    </div>
  );
}

// ── Modo A: KPI block por BU (mismo patrón visual que KPITile de Fila 1) ───────

function BuKpiRow({ item, onViewDetail }: { item: QWallBuSummaryItem; onViewDetail: () => void }) {
  const { t } = useTranslation();
  const color = semaphore(item.pass_rate, PASS_RATE_TARGET);
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
          {item.business_unit_name}
        </div>
        <button
          onClick={onViewDetail}
          style={{
            fontSize: "0.7rem", fontWeight: 600, padding: "0.25rem 0.6rem", cursor: "pointer",
            borderRadius: "var(--radius-sm, 6px)", border: "1px solid var(--color-border)",
            background: "var(--color-surface)", color: "var(--color-text-secondary)",
          }}
        >
          {t("qwallDashboard.partNumberSummary.detail.viewDetail")}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem" }}>
        <KPITile label={t("qwallDashboard.partNumberSummary.kpi.totalInspections")} value={item.inspection_count.toLocaleString()} accent="#3b82f6" />
        <KPITile label="PASS" value={item.pass.toLocaleString()} color="#10b981" accent="#10b981" />
        <KPITile label="FAIL" value={item.fail.toLocaleString()} color={item.fail > 0 ? "#ef4444" : "#10b981"} accent="#ef4444" />
        <KPITile label={t("qwallDashboard.partNumberSummary.kpi.passRate")} value={`${item.pass_rate.toFixed(1)}%`} color={color} accent={color} />
      </div>
    </div>
  );
}

// ── Modal genérico (no existía uno reusable en el proyecto — cada modal previo
// reimplementa su propio overlay; este sigue esa misma convención visual —
// overlay fixed/rgba/flex-center/zIndex — pero con los tokens de este archivo) ──

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000, padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg, 10px)", padding: "1.25rem",
          maxWidth: 720, width: "100%", maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-text-primary)" }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              fontSize: "1.1rem", color: "var(--color-text-secondary)", lineHeight: 1, padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Tabla de detalle por Part Number (usada dentro del modal de "Ver detalle") ─
// Hace su propio fetch por business_unit_id, igual que el resto de widgets de
// Modo B — solo se monta (y solo fetchea) cuando el modal está abierto.

function BuDetailTable({ businessUnitId, startDate, endDate, includeTest }: {
  businessUnitId: number; startDate: string; endDate: string; includeTest: boolean;
}) {
  const { t }     = useTranslation();
  const [items,   setItems]   = useState<QWallPartNumberSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    QWallService.getPartNumberSummary(startDate, endDate, businessUnitId, includeTest)
      .then(res => { if (!cancelled) setItems(res.items); })
      .catch(() => { if (!cancelled) setError(t("qwallDashboard.partNumberSummary.error")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [businessUnitId, startDate, endDate, includeTest, t]);

  if (loading) return <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("qwallDashboard.partNumberSummary.loading")}</p>;
  if (error)   return <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>{error}</p>;
  if (items.length === 0) return <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("qwallDashboard.partNumberSummary.noData")}</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
        <thead>
          <tr>
            <th style={thStyle}>{t("qwallDashboard.partNumberSummary.detail.columns.partNumber")}</th>
            <th style={{ ...thStyle, textAlign: "right" }}>{t("qwallDashboard.partNumberSummary.detail.columns.inspections")}</th>
            <th style={{ ...thStyle, textAlign: "right" }}>{t("qwallDashboard.partNumberSummary.detail.columns.runs")}</th>
            <th style={{ ...thStyle, textAlign: "right" }}>{t("qwallDashboard.partNumberSummary.detail.columns.passRate")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(row => (
            <tr key={row.part_number}>
              <td style={tdStyle}>{row.part_number}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{row.inspection_count}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{row.run_count}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: semaphore(row.pass_rate, PASS_RATE_TARGET) }}>
                {row.pass_rate.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sección Part Number Summary: Modo A (KPI por BU, sin interactividad) y
// Modo B (hilera de 4 widgets para la BU activa en el filtro general) ──────────

const widgetTitle: React.CSSProperties = {
  fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-secondary)",
  marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.02em",
};

function PartNumberSummarySection({ buId, startDate, endDate, includeTest, pass, fail }: {
  buId?: number; startDate: string; endDate: string; includeTest: boolean;
  pass: number; fail: number;
}) {
  const { t } = useTranslation();

  // Modo A
  const [buItems, setBuItems]     = useState<QWallBuSummaryItem[]>([]);
  const [buLoading, setBuLoading] = useState(false);
  const [buError, setBuError]     = useState<string | null>(null);
  const [detailBu, setDetailBu]   = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (buId !== undefined) return;
    let cancelled = false;
    setBuLoading(true);
    setBuError(null);
    QWallService.getBuSummary(startDate, endDate, includeTest)
      .then(res => { if (!cancelled) setBuItems(res.items); })
      .catch(() => { if (!cancelled) setBuError(t("qwallDashboard.partNumberSummary.error")); })
      .finally(() => { if (!cancelled) setBuLoading(false); });
    return () => { cancelled = true; };
  }, [buId, startDate, endDate, includeTest, t]);

  // Modo B
  const [pnSummary, setPnSummary] = useState<QWallPartNumberSummaryResponse | null>(null);
  const [pnLoading, setPnLoading] = useState(false);
  const [pnError, setPnError]     = useState<string | null>(null);

  useEffect(() => {
    if (buId === undefined) return;
    let cancelled = false;
    setPnLoading(true);
    setPnError(null);
    QWallService.getPartNumberSummary(startDate, endDate, buId, includeTest)
      .then(res => { if (!cancelled) setPnSummary(res); })
      .catch(() => { if (!cancelled) setPnError(t("qwallDashboard.partNumberSummary.error")); })
      .finally(() => { if (!cancelled) setPnLoading(false); });
    return () => { cancelled = true; };
  }, [buId, startDate, endDate, includeTest, t]);

  return (
    <div style={card}>
      <div style={cardTitle}>{t("qwallDashboard.partNumberSummary.title")}</div>

      {buId === undefined ? (
        buLoading ? (
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("qwallDashboard.partNumberSummary.loading")}</p>
        ) : buError ? (
          <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>{buError}</p>
        ) : buItems.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("qwallDashboard.partNumberSummary.noData")}</p>
        ) : (
          // 2 columnas siempre que quepan (minmax basado en % del contenedor, no
          // en un ancho fijo) — nunca más de 2 por hilera sin importar qué tan
          // ancho sea el contenedor, y colapsa a 1 en viewports angostos.
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(max(320px, calc(50% - 0.5rem)), 1fr))", gap: "1rem" }}>
            {buItems.map(bu => (
              <BuKpiRow
                key={bu.business_unit_id}
                item={bu}
                onViewDetail={() => setDetailBu({ id: bu.business_unit_id, name: bu.business_unit_name })}
              />
            ))}
          </div>
        )
      ) : pnLoading ? (
        <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("qwallDashboard.partNumberSummary.loading")}</p>
      ) : pnError ? (
        <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>{pnError}</p>
      ) : !pnSummary || pnSummary.items.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("qwallDashboard.partNumberSummary.noData")}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div>
            <div style={widgetTitle}>{t("qwallDashboard.partNumberSummary.widgets.distribution")}</div>
            <PieChart slices={buildDistributionSlices(pnSummary.items, t("qwallDashboard.partNumberSummary.widgets.other"))} />
          </div>
          <div>
            <div style={widgetTitle}>{t("qwallDashboard.partNumberSummary.widgets.runsPerPart")}</div>
            <VBarSingle data={pnSummary.items.map(it => ({ label: it.part_number, value: it.run_count }))} />
          </div>
          <div>
            <div style={widgetTitle}>{t("qwallDashboard.partNumberSummary.widgets.passVsFail")}</div>
            <PieChart slices={[
              { label: "PASS", value: pass, color: "#10b981" },
              { label: "FAIL", value: fail, color: "#ef4444" },
            ]} />
          </div>
          <div>
            <div style={widgetTitle}>{t("qwallDashboard.partNumberSummary.widgets.lowestPassRate")}</div>
            <LowestPassRateCallout item={pnSummary.lowest_pass_rate_part} />
          </div>
        </div>
      )}

      {detailBu && (
        <Modal
          title={`${t("qwallDashboard.partNumberSummary.detail.title")} — ${detailBu.name}`}
          onClose={() => setDetailBu(null)}
        >
          <BuDetailTable
            businessUnitId={detailBu.id} startDate={startDate} endDate={endDate} includeTest={includeTest}
          />
        </Modal>
      )}
    </div>
  );
}

// ── PieChart ──────────────────────────────────────────────────────────────────

function PieChart({ slices, size = 140 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let angle   = -90;
  const paths: JSX.Element[] = [];
  const midAngles: number[] = [];
  const cx = size / 2; const cy = size / 2; const r = size / 2 - 10;

  slices.forEach((s, i) => {
    const sweep = (s.value / total) * 360;
    midAngles.push(angle + sweep / 2);

    // FIX: un slice al 100% del total tiene sweep=360 — el punto final del arco
    // coincide matemáticamente con el inicial (ángulo módulo 360), y el <path>
    // de arco degenera a longitud cero (no dibuja nada). Se renderiza un
    // <circle> completo en su lugar. Aplica a CUALQUIER donut que use este
    // componente compartido (distribución por parte, Pass vs Fail, etc.).
    if (sweep >= 359.99) {
      paths.push(
        <circle key={s.label} cx={cx} cy={cy} r={r} fill={s.color} stroke="var(--color-surface)" strokeWidth={1.5}
          onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: "pointer" }} />
      );
    } else if (sweep > 0) {
      const rad1 = (angle * Math.PI) / 180;
      const rad2 = ((angle + sweep) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(rad1); const y1 = cy + r * Math.sin(rad1);
      const x2 = cx + r * Math.cos(rad2); const y2 = cy + r * Math.sin(rad2);
      const large = sweep > 180 ? 1 : 0;
      paths.push(
        <path key={s.label}
          d={`M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
          fill={s.color} stroke="var(--color-surface)" strokeWidth={1.5}
          onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: "pointer" }} />
      );
    }
    angle += sweep;
  });

  const hovered = hoverIdx !== null ? slices[hoverIdx] : null;
  const tipAngleRad = hoverIdx !== null ? (midAngles[hoverIdx] * Math.PI) / 180 : 0;
  const tipX = cx + r * 0.65 * Math.cos(tipAngleRad);
  const tipY = cy + r * 0.65 * Math.sin(tipAngleRad);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{paths}</svg>
        {hovered && (
          <div style={{
            position: "absolute", left: `${(tipX / size) * 100}%`, top: `${(tipY / size) * 100}%`,
            transform: "translate(-50%, -100%)",
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "8px", padding: "0.4rem 0.6rem", fontSize: "0.7rem",
            color: "var(--color-text-primary)", pointerEvents: "none", zIndex: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
          }}>
            <div style={{ fontWeight: 700 }}>{hovered.label}</div>
            <div>{hovered.value.toLocaleString()} ({((hovered.value / total) * 100).toFixed(1)}%)</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {slices.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.68rem" }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-secondary)" }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: "var(--color-text-primary)", marginLeft: "auto", paddingLeft: "0.4rem" }}>
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
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
  const [failByPoint, setFailByPoint] = useState<QWallFailByPointResponse | null>(null);

  // Cargar catálogo BU/PN una sola vez
  useEffect(() => {
    QWallService.getPartNumbers().then(setPartCatalog).catch(() => {});
  }, []);

  const buList: string[] = [...new Set(partCatalog.map(p => p.bu_name))].sort();

  // bu_id correspondiente al nombre de BU seleccionado (el backend filtra por bu_id)
  const buId: number | undefined = buFilter
    ? partCatalog.find(p => p.bu_name === buFilter)?.bu_id
    : undefined;

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
      const [report, pointFails] = await Promise.all([
        QWallService.getReport(s, e, includeTest, buId),
        QWallService.getFailByPoint(s, e, includeTest, buId),
      ]);
      setData(report);
      setFailByPoint(pointFails);
    } catch {
      setError(l ? "Error cargando datos." : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, includeTest, buId, l]);

  // Auto-reload cuando cambia el toggle de pruebas/producción o el filtro de BU
  // (el backend ya filtra por bu_id, no se re-deriva client-side)
  useEffect(() => {
    if (data !== null) load(startDate, endDate);
  }, [includeTest, buId]);

  const derived        = data ? deriveFromRows(data.rows) : null;
  const passRate       = derived?.summary.pass_rate ?? 0;
  const failCount      = derived?.summary.fail ?? 0;
  const flagCount         = data?.flag_count ?? 0;
  const changeoverCount   = data?.changeover_count ?? 0;
  const pointFailItems    = failByPoint?.items ?? [];

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
            BU: {buFilter} · {data.rows.length} {l ? "inspecciones" : "inspections"}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.875rem" }}>
            <KPITile label={l ? "Total Inspecciones" : "Total Inspections"} value={derived.summary.total.toLocaleString()} accent="#3b82f6" />
            <KPITile label="PASS" value={derived.summary.pass.toLocaleString()} color="#10b981" accent="#10b981" />
            <KPITile label="FAIL" value={derived.summary.fail.toLocaleString()} color={failCount > 0 ? "#ef4444" : "#10b981"} accent="#ef4444" />
            <KPITile label={l ? "Tasa de Aprobación" : "Pass Rate"} value={`${passRate.toFixed(1)}%`}
              color={semaphore(passRate, 95)} accent={semaphore(passRate, 95)}  />
            <KPITile label={l ? "Tiempo Promedio" : "Avg Cycle Time"} value={fmtDuration(Math.round(derived.summary.avg_duration))}  />
            <KPITile label={l ? "Piezas con Flag" : "Flagged Pieces"} value={flagCount.toLocaleString()} accent="#f59e0b" />
            <KPITile label={l ? "Cambios de Modelo" : "Model Changeovers"} value={changeoverCount.toLocaleString()} accent="#8b5cf6" />
          </div>

          {/* ── FILA 2: Part Number Summary ── */}
          <PartNumberSummarySection
            buId={buId} startDate={startDate} endDate={endDate} includeTest={includeTest}
            pass={derived.summary.pass} fail={derived.summary.fail}
          />

          {/* ── FILA 3: Tendencia ── */}
         

          {/* ── FILA 4: Fail modes + Inspectores ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
             <div style={card}>
            <div style={cardTitle}>{l ? "Tendencia" : "Trend"}</div>
            <TrendChart
              startDate={startDate}
              endDate={endDate}
              includeTest={includeTest}
              buId={buId}
              locale={i18n.language}
            />
          </div>
            <div style={card}>
              <div style={cardTitle}>{l ? "Top fallas (Pareto)" : "Top fail modes (Pareto)"}</div>
              <ParetoChart
                startDate={startDate}
                endDate={endDate}
                includeTest={includeTest}
                buId={buId}
                lang={l ? "es" : "en"}
              />
            </div>
            
          </div>

          
        </>
      )}
    </div>
  );
}