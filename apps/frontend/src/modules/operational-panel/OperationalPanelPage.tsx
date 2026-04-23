import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { OpsReportService } from "../production/ops-report/ops-report.service";
import { MaintenanceService } from "../maintenance/overview/overview.service";
import { WorkRequestsService } from "../maintenance/work-requests/work-requests.service";
import { QualityService } from "../quality/services/quality.service";
import { DailySummary } from "../production/ops-report/types";
import { MaintenanceKPIs, OEEData } from "../maintenance/overview/types";
import { WRDashboard } from "../maintenance/work-requests/types";

// ── Types locales ─────────────────────────────────────────────────────────────

interface ReasonRow {
  scrap_reason: string;
  total_qty:    number;
  total_cost:   number;
  pct_of_total: number;
}

interface ScrapData {
  summary:       { total_qty: number; total_cost: number; yield_pct: number };
  by_reason:     ReasonRow[];
  by_workcenter: unknown[];
  by_part:       unknown[];
  by_shift:      unknown[];
  trend:         unknown[];
}

interface OEERecord {
  date:             string;
  availability_pct: string;
  performance_pct:  string;
  quality_pct:      string;
  oee_pct:          string;
  recorded_at:      string;
}

type DateMode = "day" | "range";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function startOfMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function semaphore(value: number, target: number, lowerBetter = false): string {
  if (lowerBetter) {
    return value <= target ? "#10b981" : value <= target * 1.5 ? "#f59e0b" : "#ef4444";
  }
  return value >= target ? "#10b981" : value >= target * 0.9 ? "#f59e0b" : "#ef4444";
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub, path, navigate }: {
  title: string; sub?: string; path: string; navigate: (p: string) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.875rem" }}>
      <div>
        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "0.03em" }}>
          {title}
        </div>
        {sub && (
          <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginTop: "0.125rem" }}>{sub}</div>
        )}
      </div>
      <button
        onClick={() => navigate(path)}
        style={{
          fontSize: "0.7rem", fontWeight: 600, color: "#3b82f6",
          background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: "var(--radius-sm)", padding: "0.25rem 0.625rem",
          cursor: "pointer",
        }}
      >
        Ver más →
      </button>
    </div>
  );
}

function KPITile({ label, value, color, sub }: {
  label: string; value: string | number | null; color: string; sub?: string;
}) {
  return (
    <div style={{
      background: "var(--color-bg)", border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)", padding: "0.875rem 1rem",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginTop: "0.125rem" }}>{sub}</div>}
    </div>
  );
}

function MiniDonut({ value, color, size = 80, label }: {
  value: number | null; color: string; size?: number; label: string;
}) {
  const r    = 30;
  const circ = 2 * Math.PI * r;
  const safe = value ?? 0;
  const fill = Math.min((safe / 100) * circ, circ);
  const cx   = size / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-border)" strokeWidth={8} />
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
            {value != null ? `${safe.toFixed(0)}%` : "—"}
          </span>
        </div>
      </div>
      <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "center" }}>
        {label}
      </span>
    </div>
  );
}

function ClientBadge({ label, qty, target, yieldPct }: {
  label: string; qty: number; target: number; yieldPct: number;
}) {
  const pct   = target > 0 ? Math.min((qty / target) * 100, 100) : 0;
  const color = semaphore(pct, 90);
  return (
    <div style={{
      background: "var(--color-bg)", border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)", padding: "0.75rem", flex: 1,
    }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
        {qty.toLocaleString()}
        <span style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>
          / {target.toLocaleString()}
        </span>
      </div>
      <div style={{ margin: "0.375rem 0", height: 5, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)" }}>
        Yield: <span style={{ fontWeight: 700, color: semaphore(yieldPct, 98) }}>{yieldPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function MiniBarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            fontSize: "0.65rem", color: "var(--color-text-secondary)",
            width: 72, textAlign: "right", flexShrink: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: 12, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: color, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--color-text-primary)", width: 32, textAlign: "right", flexShrink: 0 }}>
            {d.value.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: `${color}12`, border: `1px solid ${color}40`,
      borderRadius: "var(--radius-md)", padding: "0.625rem 0.75rem", flex: 1,
    }}>
      <div style={{ fontSize: "1.375rem", fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)", textAlign: "center", marginTop: "0.125rem" }}>{label}</div>
    </div>
  );
}

const panelCard: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
};

// ── DateControl ───────────────────────────────────────────────────────────────

interface DateControlProps {
  mode:        DateMode;
  singleDate:  string;
  rangeStart:  string;
  rangeEnd:    string;
  loading:     boolean;
  lang:        string;
  onModeChange:       (m: DateMode) => void;
  onSingleChange:     (d: string) => void;
  onRangeStartChange: (d: string) => void;
  onRangeEndChange:   (d: string) => void;
  onRefresh:   () => void;
}

function DateControl({
  mode, singleDate, rangeStart, rangeEnd, loading, lang,
  onModeChange, onSingleChange, onRangeStartChange, onRangeEndChange, onRefresh,
}: DateControlProps) {
  const l = lang === "es";

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.3rem 0.75rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
    cursor: "pointer",
    background: active ? "#3b82f6" : "var(--color-surface)",
    color:      active ? "#fff"    : "var(--color-text-secondary)",
    transition: "all 0.15s",
  });

  const inputStyle: React.CSSProperties = {
    padding: "0.3rem 0.5rem",
    fontSize: "0.75rem",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-text-primary)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
      {/* Toggle modo */}
      <div style={{ display: "flex", gap: "0.25rem" }}>
        <button style={toggleStyle(mode === "day")}   onClick={() => onModeChange("day")}>
          {l ? "Día" : "Day"}
        </button>
        <button style={toggleStyle(mode === "range")} onClick={() => onModeChange("range")}>
          {l ? "Rango" : "Range"}
        </button>
      </div>

      {/* Inputs según modo */}
      {mode === "day" ? (
        <input
          type="date"
          value={singleDate}
          max={todayStr()}
          style={inputStyle}
          onChange={(e) => onSingleChange(e.target.value)}
        />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <input
            type="date"
            value={rangeStart}
            max={rangeEnd}
            style={inputStyle}
            onChange={(e) => onRangeStartChange(e.target.value)}
          />
          <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>→</span>
          <input
            type="date"
            value={rangeEnd}
            min={rangeStart}
            max={todayStr()}
            style={inputStyle}
            onChange={(e) => onRangeEndChange(e.target.value)}
          />
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          padding: "0.3rem 0.875rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "0.75rem", fontWeight: 600,
          opacity: loading ? 0.5 : 1,
        }}
      >
        {loading ? (l ? "Cargando..." : "Loading...") : "↻"}
      </button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

interface PanelData {
  prod:    DailySummary | null;
  oee:     OEERecord | null;
  maint:   MaintenanceKPIs | null;
  oeeLive: OEEData | null;
  wr:      WRDashboard | null;
  scrap:   ScrapData | null;
}

export default function OperationalPanelPage() {
  const { i18n } = useTranslation();
  const navigate  = useNavigate();
  const lang      = i18n.language.startsWith("es") ? "es" : "en";
  const l         = lang === "es";

  // ── Estado de fechas ──────────────────────────────────────────────────────
  const [dateMode,    setDateMode]    = useState<DateMode>("day");
  const [singleDate,  setSingleDate]  = useState(todayStr());
  const [rangeStart,  setRangeStart]  = useState(startOfMonthStr());
  const [rangeEnd,    setRangeEnd]    = useState(todayStr());

  // Derivados: qué fechas usar para cada endpoint
  // Producción siempre necesita un solo día → en rango usamos rangeEnd
  const prodDate  = dateMode === "day" ? singleDate : rangeEnd;
  const dateStart = dateMode === "day" ? singleDate : rangeStart;
  const dateEnd   = dateMode === "day" ? singleDate : rangeEnd;

  const [data,       setData]       = useState<PanelData>({ prod: null, oee: null, maint: null, oeeLive: null, wr: null, scrap: null });
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prod, oee, maintRes, oeeLive, wr, scrapRes] = await Promise.all([
        OpsReportService.getDailySummary(prodDate).catch(() => null),
        OpsReportService.getOEE(prodDate).catch(() => null),
        MaintenanceService.getKPIs(dateStart, dateEnd).catch(() => null),
        MaintenanceService.getOEELive(dateStart, dateEnd).catch(() => null),
        WorkRequestsService.getDashboard(dateStart, dateEnd).catch(() => null),
        QualityService.getScrapDetail({ start_date: dateStart, end_date: dateEnd, use_shift: false }).catch(() => null),
      ]);
      setData({
        prod:    prod    ?? null,
        oee:     oee     ?? null,
        maint:   (maintRes as any)?.data ?? null,
        oeeLive: oeeLive ?? null,
        wr:      wr      ?? null,
        scrap:   scrapRes as ScrapData | null,
      });
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [prodDate, dateStart, dateEnd]);

  // Carga automática cuando cambian las fechas
  useEffect(() => { load(); }, [load]);

  // Auto-refresh cada 5 min solo si estamos en "hoy"
  useEffect(() => {
    const isToday = dateMode === "day"
      ? singleDate === todayStr()
      : rangeEnd   === todayStr();
    if (!isToday) return;
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, dateMode, singleDate, rangeEnd]);

  // ── Valores derivados ─────────────────────────────────────────────────────
  const volvo   = data.prod?.volvo;
  const cummins = data.prod?.cummins;
  const tulc    = data.prod?.tulc;

  const oeePct   = data.oee ? parseFloat(data.oee.oee_pct)          : data.oeeLive ? parseFloat(data.oeeLive.oee_pct as string)          : null;
  const availPct = data.oee ? parseFloat(data.oee.availability_pct)  : data.oeeLive ? parseFloat(data.oeeLive.availability_pct as string)  : null;
  const perfPct  = data.oee ? parseFloat(data.oee.performance_pct)   : data.oeeLive ? parseFloat(data.oeeLive.performance_pct as string)   : null;
  const qualPct  = data.oee ? parseFloat(data.oee.quality_pct)       : data.oeeLive ? parseFloat(data.oeeLive.quality_pct as string)       : null;

  const mttr       = data.maint?.mttr_hours    ?? null;
  const mtbf       = data.maint?.mtbf_hours    ?? null;
  const totalFails = data.maint?.total_failures ?? null;

  const wrKpis       = data.wr?.kpis;
  const byStatus     = data.wr?.by_status.slice(0, 4) ?? [];
  const completedPct = wrKpis?.completed_pct ?? 0;
  const backlog      = wrKpis?.backlog ?? 0;

  const yieldFPY = data.scrap?.summary.yield_pct ?? null;
  const scrapQty = data.scrap?.summary.total_qty ?? null;

  const topReasons: { label: string; value: number }[] =
    (data.wr?.by_failure ?? []).slice(0, 4).map((f) => ({ label: f.label, value: f.hours }));

  const topScrapReasons: { label: string; value: number }[] =
    (data.scrap?.by_reason ?? []).slice(0, 4).map((r: ReasonRow) => ({ label: r.scrap_reason, value: r.total_qty }));

  // Label del período para mostrar en subtítulos de cards
  const periodLabel = dateMode === "day"
    ? singleDate
    : `${rangeStart} → ${rangeEnd}`;

  const prodLabel = dateMode === "range"
    ? (l ? `Día de referencia: ${rangeEnd}` : `Reference day: ${rangeEnd}`)
    : singleDate;

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            {l ? "Panel Operativo" : "Operational Panel"}
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" }}>
           {lastUpdate && ` · ${l ? "Actualizado" : "Updated"} ${lastUpdate.toLocaleTimeString()}`}
          </p>
        </div>

        {/* Control de fechas + refresh */}
        <DateControl
          mode={dateMode}
          singleDate={singleDate}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          loading={loading}
          lang={lang}
          onModeChange={setDateMode}
          onSingleChange={setSingleDate}
          onRangeStartChange={setRangeStart}
          onRangeEndChange={setRangeEnd}
          onRefresh={load}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          {l ? "Cargando datos operativos..." : "Loading operational data..."}
        </div>
      ) : (
        <>
          {/* ── FILA 1 — KPI strip ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.875rem" }}>
            <KPITile
              label={l ? "Yield FPY" : "FPY Yield"}
              value={yieldFPY != null ? `${yieldFPY.toFixed(1)}%` : "—"}
              color={yieldFPY != null ? semaphore(yieldFPY, 98) : "#6b7280"}
              sub="Meta ≥ 98%"
            />
            <KPITile
              label="OEE"
              value={oeePct != null ? `${oeePct.toFixed(1)}%` : "—"}
              color={oeePct != null ? semaphore(oeePct, 65) : "#6b7280"}
              sub="Meta ≥ 65%"
            />
            <KPITile
              label="MTTR"
              value={mttr != null ? `${mttr.toFixed(1)} hrs` : "—"}
              color={mttr != null ? semaphore(mttr, 2, true) : "#6b7280"}
              sub={l ? "Meta ≤ 2 hrs" : "Target ≤ 2 hrs"}
            />
            <KPITile
              label="MTBF"
              value={mtbf != null ? `${mtbf.toFixed(1)} hrs` : "—"}
              color={mtbf != null ? semaphore(mtbf, 40) : "#6b7280"}
              sub={l ? "Meta ≥ 40 hrs" : "Target ≥ 40 hrs"}
            />
            <KPITile
              label={l ? "Backlog WR" : "WR Backlog"}
              value={backlog}
              color={backlog === 0 ? "#10b981" : backlog <= 5 ? "#f59e0b" : "#ef4444"}
              sub={l ? "Work Requests vencidas" : "Overdue Work Requests"}
            />
            <KPITile
              label={l ? "Scrap (pzas)" : "Scrap qty"}
              value={scrapQty != null ? scrapQty.toLocaleString() : "—"}
              color={scrapQty != null ? (scrapQty === 0 ? "#10b981" : scrapQty < 10 ? "#f59e0b" : "#ef4444") : "#6b7280"}
              sub={l ? "Piezas rechazadas" : "Rejected parts"}
            />
          </div>

          {/* ── FILA 2 — Tres paneles ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>

            {/* PRODUCCIÓN */}
            <div style={panelCard}>
              <SectionHeader
                title={l ? "Producción" : "Production"}
                sub={prodLabel}
                path="/production/ops-daily-report"
                navigate={navigate}
              />
              <div style={{ display: "flex", gap: "0.625rem", marginBottom: "0.875rem" }}>
                {volvo   && <ClientBadge label="VOLVO"   qty={volvo.quantity}   target={volvo.target}   yieldPct={volvo.yield_pct}   />}
                {cummins && <ClientBadge label="CUMMINS" qty={cummins.quantity} target={cummins.target} yieldPct={cummins.yield_pct} />}
                {tulc    && <ClientBadge label="TULC"    qty={tulc.quantity}    target={tulc.target}    yieldPct={tulc.yield_pct}    />}
              </div>
              {dateMode === "range" && (
                <div style={{
                  fontSize: "0.7rem", color: "var(--color-text-secondary)",
                  background: "var(--color-bg)", borderRadius: "var(--radius-sm)",
                  padding: "0.375rem 0.625rem", marginBottom: "0.75rem",
                  border: "1px solid var(--color-border)",
                }}>
                  ⚠ {l
                    ? "Producción muestra el último día del rango. Para acumulado usa Ops Daily Report."
                    : "Production shows last day of range. For cumulative use Ops Daily Report."}
                </div>
              )}
              <div style={{ marginTop: "auto" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                  {l ? "Yield por cliente" : "Yield by client"}
                </div>
                <MiniBarChart
                  color="#3b82f6"
                  data={[
                    { label: "VOLVO",   value: volvo?.yield_pct   ?? 0 },
                    { label: "CUMMINS", value: cummins?.yield_pct ?? 0 },
                    { label: "TULC",    value: tulc?.yield_pct    ?? 0 },
                  ]}
                />
              </div>
            </div>

            {/* OEE / MANTENIMIENTO */}
            <div style={panelCard}>
              <SectionHeader
                title={l ? "OEE & Mantenimiento" : "OEE & Maintenance"}
                sub={periodLabel}
                path="/maintenance/overview"
                navigate={navigate}
              />
              <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "1rem" }}>
                <MiniDonut value={oeePct}   color="#f59e0b" label="OEE"                        />
                <MiniDonut value={availPct} color="#3b82f6" label={l ? "Dispon." : "Avail."}  />
                <MiniDonut value={perfPct}  color="#8b5cf6" label="Perf."                       />
                <MiniDonut value={qualPct}  color="#10b981" label={l ? "Calidad" : "Quality"} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "auto" }}>
                {[
                  { label: "MTTR",                          val: mttr != null ? `${mttr.toFixed(1)}h` : "—",   color: mttr != null ? semaphore(mttr, 2, true) : "#6b7280" },
                  { label: "MTBF",                          val: mtbf != null ? `${mtbf.toFixed(1)}h` : "—",   color: mtbf != null ? semaphore(mtbf, 40)      : "#6b7280" },
                  { label: l ? "Fallas" : "Failures",      val: totalFails ?? "—",                             color: "var(--color-text-primary)" },
                ].map((item) => (
                  <div key={item.label} style={{
                    background: "var(--color-bg)", border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)", padding: "0.625rem", textAlign: "center",
                  }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--color-text-secondary)" }}>{item.label}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: item.color }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CALIDAD */}
            <div style={panelCard}>
              <SectionHeader
                title={l ? "Calidad" : "Quality"}
                sub={periodLabel}
                path="/quality/dashboard"
                navigate={navigate}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1rem" }}>
                <MiniDonut
                  value={yieldFPY}
                  color={yieldFPY != null ? semaphore(yieldFPY, 98) : "#6b7280"}
                  size={90}
                  label="FPY Yield"
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>
                    {l ? "Scrap total (pzas)" : "Total scrap (pcs)"}
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
                    {scrapQty?.toLocaleString() ?? "—"}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                    {l ? "Meta Yield ≥ 98%" : "Yield target ≥ 98%"}
                  </div>
                </div>
              </div>
              {topScrapReasons.length > 0 && (
                <div style={{ marginTop: "auto" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                    {l ? "Top razones de scrap (qty)" : "Top scrap reasons (qty)"}
                  </div>
                  <MiniBarChart color="#ef4444" data={topScrapReasons} />
                </div>
              )}
            </div>
          </div>

          {/* ── FILA 3 — Work Requests ── */}
          <div style={panelCard}>
            <SectionHeader
              title={l ? "Work Requests — Mantenimiento" : "Maintenance Work Requests"}
              sub={periodLabel}
              path="/maintenance/work-requests"
              navigate={navigate}
            />
            <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                {byStatus.map((s) => (
                  <StatusPill
                    key={s.label}
                    label={s.label}
                    value={s.count}
                    color={
                      s.label.toLowerCase().includes("complet") ? "#10b981" :
                      s.label.toLowerCase().includes("progress") || s.label.toLowerCase().includes("curso") ? "#3b82f6" :
                      s.label.toLowerCase().includes("pend") ? "#f59e0b" : "#6b7280"
                    }
                  />
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginBottom: "0.375rem" }}>
                  {l ? `Completados: ${completedPct.toFixed(0)}%` : `Completed: ${completedPct.toFixed(0)}%`}
                </div>
                <div style={{ height: 12, background: "var(--color-border)", borderRadius: 6, overflow: "hidden", marginBottom: "0.75rem" }}>
                  <div style={{
                    height: "100%", width: `${completedPct}%`,
                    background: semaphore(completedPct, 80),
                    borderRadius: 6, transition: "width 0.4s",
                  }} />
                </div>
                <div style={{ display: "flex", gap: "1.5rem" }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>Total WR: </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{wrKpis?.total_wr ?? "—"}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>Backlog: </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: backlog > 0 ? "#ef4444" : "#10b981" }}>{backlog}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>{l ? "Hrs reales: " : "Actual hrs: "}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                      {wrKpis?.total_maintenance?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                  {wrKpis?.top_failure && (
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>{l ? "Falla top: " : "Top failure: "}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#8b5cf6" }}>{wrKpis.top_failure}</span>
                    </div>
                  )}
                </div>
              </div>
              {topReasons.length > 0 && (
                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                    {l ? "Top fallas (hrs)" : "Top failures (hrs)"}
                  </div>
                  <MiniBarChart color="#8b5cf6" data={topReasons} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}