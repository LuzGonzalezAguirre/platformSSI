import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Clock } from "lucide-react";
import { OpsReportService } from "./ops-report.service";
import { DailySummary, ClientMetrics, ViewMode } from "./types";
import { SafetyService } from "../safety/safety.service";
import { SafetySettings } from "../safety/types";
import { AssistanceService } from "../assistance/assistance.service";
import ProductionTable from "./ProductionTable";
import ProductionCharts from "./ProductionCharts";


function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
interface DonutProps {
  value: number;
  color: string;
  size?: number;
}

function DonutChart({ value, color, size = 160 }: DonutProps) {
  const radius = 54;
  const stroke = 12;
  const circ   = 2 * Math.PI * radius;
  const filled = Math.min((value / 100) * circ, circ);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ── KPI Progress Bar ──────────────────────────────────────────────────────────
function KPIBar({
  label, value, target, unit = "%", lowerBetter = false, subLabel,
}: {
  label: string; value: number; target: number;
  unit?: string; lowerBetter?: boolean; subLabel?: string;
}) {
  const meets  = lowerBetter ? value <= target : value >= target;
  const warn   = lowerBetter ? value <= target * 1.5 : value >= target * 0.9;
  const color  = meets ? "#10b981" : warn ? "#f59e0b" : "#ef4444";
  const maxVal = lowerBetter ? target * 2 : target * 1.2;
  const barPct = Math.min((value / maxVal) * 100, 100);
  const tgtPct = Math.min((target / maxVal) * 100, 100);
  const delta  = value - target;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
          {label}
        </span>
        <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
          {value.toFixed(lowerBetter ? 2 : 1)}{unit}
        </span>
      </div>
      <div style={{ position: "relative", height: "18px", background: "var(--color-border)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ position: "absolute", height: "100%", width: `${barPct}%`, background: color, transition: "width 0.4s ease" }} />
        <div style={{ position: "absolute", height: "100%", width: "2px", background: "var(--color-text-primary)", left: `${tgtPct}%` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--color-text-tertiary)" }}>
        <span>{subLabel ?? `Target: ${lowerBetter ? "<" : ""}${target}${unit}`}</span>
        <span style={{ color, fontWeight: 600 }}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(lowerBetter ? 2 : 1)}{unit}
        </span>
      </div>
    </div>
  );
}

// ── Client Block ──────────────────────────────────────────────────────────────
function ClientBlock({ data, lang }: { data: ClientMetrics; lang: "es" | "en" }) {
  const wipPct = data.wip_goal > 0
    ? Math.min((data.wip_actual / data.wip_goal) * 100, 100)
    : 0;
  const wipColor = data.wip_actual <= data.wip_goal * 0.8
    ? "#10b981"
    : data.wip_actual <= data.wip_goal
    ? "#f59e0b"
    : "#ef4444";

  const s = clientStyles;

  return (
    <div style={s.block}>
      <div style={s.kpiGrid}>
        {/* Production % */}
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>{lang === "es" ? "Producción" : "Production"}</div>
          <div style={s.kpiMain}>
            <span style={{
              ...s.kpiValue,
              color: data.production_pct >= 100 ? "#10b981"
                : data.production_pct >= 90 ? "#f59e0b" : "#ef4444",
            }}>
              {data.production_pct.toFixed(1)}%
            </span>
          </div>
          <div style={s.kpiSub}>
            {data.quantity.toLocaleString()} / {data.target.toLocaleString()} {lang === "es" ? "pzas" : "pcs"}
          </div>
          <div style={s.barTrack}>
            <div style={{
              ...s.barFill,
              width: `${Math.min(data.production_pct, 100)}%`,
              background: data.production_pct >= 100 ? "#10b981"
                : data.production_pct >= 90 ? "#f59e0b" : "#ef4444",
            }} />
            <div style={{ ...s.barTarget, left: "100%" }} />
          </div>
          <div style={s.barLabels}>
            <span>Target: {data.target.toLocaleString()}</span>
            <span style={{ color: data.production_pct >= 100 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
              {data.production_pct >= 100 ? "✓" : `${(data.quantity - data.target).toLocaleString()} pcs`}
            </span>
          </div>
        </div>

        {/* WIP */}
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>WIP (Line)</div>
          <div style={s.kpiMain}>
            <span style={{ ...s.kpiValue, color: wipColor }}>
              {data.wip_actual.toLocaleString()}
            </span>
          </div>
          <div style={s.kpiSub}>Goal: {data.wip_goal.toLocaleString()} {lang === "es" ? "pzas" : "pcs"}</div>
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width: `${wipPct}%`, background: wipColor }} />
            <div style={{ ...s.barTarget, left: "100%" }} />
          </div>
          <div style={s.barLabels}>
            <span>{wipPct.toFixed(1)}% of goal</span>
            <span style={{ color: wipColor, fontWeight: 600 }}>
              {data.wip_actual <= data.wip_goal ? "✓" : `+${(data.wip_actual - data.wip_goal).toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Yield */}
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Yield</div>
          <div style={s.kpiMain}>
            <span style={{
              ...s.kpiValue,
              color: data.yield_pct >= 98 ? "#10b981"
                : data.yield_pct >= 95 ? "#f59e0b" : "#ef4444",
            }}>
              {data.yield_pct.toFixed(1)}%
            </span>
          </div>
          <div style={s.kpiSub}>Target ≥ 98%</div>
          <div style={s.barTrack}>
            <div style={{
              ...s.barFill,
              width: `${Math.min(data.yield_pct, 100)}%`,
              background: data.yield_pct >= 98 ? "#10b981"
                : data.yield_pct >= 95 ? "#f59e0b" : "#ef4444",
            }} />
            <div style={{ ...s.barTarget, left: "98%" }} />
          </div>
          <div style={s.barLabels}>
            <span>Target: 98%</span>
            <span style={{
              color: data.yield_pct >= 98 ? "#10b981" : "#ef4444",
              fontWeight: 600,
            }}>
              {(data.yield_pct - 98).toFixed(1)} pp
            </span>
          </div>
        </div>

        {/* Scrap %COGP */}
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Scrap %COGP</div>
          <div style={s.kpiMain}>
            <span style={{
              ...s.kpiValue,
              color: data.scrap_cogp_pct <= 2 ? "#10b981"
                : data.scrap_cogp_pct <= 3 ? "#f59e0b" : "#ef4444",
            }}>
              {data.scrap_cogp_pct.toFixed(2)}%
            </span>
          </div>
          <div style={s.kpiSub}>{data.scrap_qty} {lang === "es" ? "pzas scrap" : "scrap pcs"}</div>
          <div style={s.barTrack}>
            <div style={{
              ...s.barFill,
              width: `${Math.min((data.scrap_cogp_pct / 4) * 100, 100)}%`,
              background: data.scrap_cogp_pct <= 2 ? "#10b981"
                : data.scrap_cogp_pct <= 3 ? "#f59e0b" : "#ef4444",
            }} />
            <div style={{ ...s.barTarget, left: "50%" }} />
          </div>
          <div style={s.barLabels}>
            <span>Target: &lt; 2%</span>
            <span style={{
              color: data.scrap_cogp_pct <= 2 ? "#10b981" : "#ef4444",
              fontWeight: 600,
            }}>
              {data.scrap_cogp_pct <= 2 ? "✓" : `+${(data.scrap_cogp_pct - 2).toFixed(2)} pp`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const clientStyles: Record<string, React.CSSProperties> = {
  block:    { display: "flex", flexDirection: "column", gap: "1rem" },
  kpiGrid:  { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" },
  kpiCard:  { padding: "1rem 1.125rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "0.375rem" },
  kpiLabel: { fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  kpiMain:  { display: "flex", alignItems: "baseline", gap: "0.25rem" },
  kpiValue: { fontSize: "1.75rem", fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.1 },
  kpiSub:   { fontSize: "0.75rem", color: "var(--color-text-tertiary)" },
  barTrack: { position: "relative" as const, height: "16px", background: "var(--color-border)", borderRadius: "4px", overflow: "hidden", marginTop: "0.25rem" },
  barFill:  { position: "absolute" as const, height: "100%", borderRadius: "4px", transition: "width 0.4s ease" },
  barTarget:{ position: "absolute" as const, height: "100%", width: "2px", background: "rgba(0,0,0,0.4)", top: 0 },
  barLabels:{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--color-text-tertiary)" },
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OpsReportPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode]         = useState<ViewMode>("daily");
  const [activeClient, setActiveClient] = useState<"volvo" | "cummins">("volvo");
  const [summary, setSummary]           = useState<DailySummary | null>(null);
  const [safety, setSafety]             = useState<SafetySettings | null>(null);
  const [paidHours, setPaidHours]       = useState<number>(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, saf] = await Promise.all([
        OpsReportService.getDailySummary(selectedDate),
        SafetyService.getSettings(),
      ]);
      setSummary(sum);
      setSafety(saf);
      try {
        const records = await AssistanceService.getAttendance(selectedDate);
        const total   = records.reduce((acc, r) => acc + (parseFloat(r.hours) || 0), 0);
        setPaidHours(total);
      } catch {
        setPaidHours(0);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || (lang === "es" ? "Error cargando datos" : "Error loading data"));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, lang]);

  useEffect(() => { load(); }, [load]);

  const productivityPct = paidHours > 0 && summary
    ? Math.min(((summary.earned_labor_hours / paidHours) * 100), 100)
    : 0;

  const generalYield = summary?.total.yield_pct ?? 0;
  const oeePct       = 47.0;

  const s = styles;

  const CLIENTS = [
    { key: "volvo"   as const, label: "VOLVO"   },
    { key: "cummins" as const, label: "CUMMINS" },
  ];

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.title}>{lang === "es" ? "Reporte Diario Ops" : "Ops Daily Report"}</h1>
          <p style={s.subtitle}>Out Tijuana</p>
        </div>
        <div style={s.dateControl}>
          <label style={s.fieldLabel}>{lang === "es" ? "Fecha:" : "Date:"}</label>
          <input
            type="date" value={selectedDate} max={todayStr()}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={s.dateInput}
          />
          <div style={s.viewModeGroup}>
            {(["daily", "weekly", "monthly"] as ViewMode[]).map((m) => (
              <button
                key={m}
                style={{
                  ...s.viewModeBtn,
                  ...(viewMode === m ? s.viewModeBtnActive : {}),
                }}
                onClick={() => setViewMode(m)}
              >
                {m === "daily"
                  ? (lang === "es" ? "Diario" : "Daily")
                  : m === "weekly"
                  ? (lang === "es" ? "Semanal" : "Weekly")
                  : (lang === "es" ? "Mensual" : "Monthly")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {loading ? (
        <div style={s.loadingState}>
          {lang === "es" ? "Cargando datos Plex..." : "Loading Plex data..."}
        </div>
      ) : (
        <>
          {/* SAFETY BANNER */}
          <div style={s.safetyBanner}>
            <div style={s.safetyLeft}>
              <div style={s.safetyDateBox}>
                <span style={s.safetyDateLabel}>{lang === "es" ? "Día" : "Day"}</span>
                <span style={s.safetyDateValue}>
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                    lang === "es" ? "es-MX" : "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </span>
              </div>
              <div style={s.safetyDaysBlock}>
                <ShieldCheck size={22} color="#10b981" />
                <div>
                  <div style={s.safetyDaysNumber}>
                    {safety?.days_without_incident ?? 0}
                    <span style={s.safetyDaysUnit}>{lang === "es" ? " días" : " days"}</span>
                  </div>
                  <div style={s.safetyDaysLabel}>
                    {lang === "es" ? "Sin incidentes / accidentes" : "No Incidents / Accidents"}
                  </div>
                </div>
              </div>
            </div>
            <div style={s.safetyRight}>
              <span style={s.safetyNote}>
                {lang === "es"
                  ? "Solo si hubo: Primeros Auxilios, Incidentes, Registrables, COVID+"
                  : "Only if incident: First Aids, Incidents, Recordables, COVID Positives"}
              </span>
            </div>
          </div>

          {/* PRODUCTIVITY BARS */}
          <div style={s.productivityCard}>
            <div style={s.prodBarSection}>
              <KPIBar
                label={lang === "es" ? "Productividad" : "Productivity"}
                value={productivityPct} target={85}
                subLabel={`${summary?.earned_labor_hours.toFixed(1)} / ${paidHours.toFixed(1)} hrs`}
              />
            </div>
            <div style={s.prodBarSection}>
              <KPIBar
                label={lang === "es" ? "Yield General" : "General Yield"}
                value={generalYield} target={98}
              />
            </div>
            <div style={s.prodBarSection}>
              <KPIBar label="OEE" value={oeePct} target={65} />
            </div>
            <div style={s.earnedHoursBlock}>
              <Clock size={16} color="var(--color-text-secondary)" />
              <div>
                <div style={s.earnedHoursValue}>
                  {summary?.earned_labor_hours.toFixed(1)} / {paidHours.toFixed(1)}
                </div>
                <div style={s.earnedHoursLabel}>
                  {lang === "es" ? "Horas ganadas / pagadas" : "Earned / Paid Hours"}
                </div>
              </div>
            </div>
          </div>

          {/* DONUT CHARTS */}
          <div style={s.donutGrid}>
            {[
              { label: lang === "es" ? "Disponibilidad" : "Availability", value: 85 },
              { label: "SSI Performance", value: productivityPct },
              { label: lang === "es" ? "Calidad" : "Quality", value: generalYield },
            ].map((d) => (
              <div key={d.label} style={s.donutCard}>
                <div style={s.donutCardTitle}>{d.label}</div>
                <DonutChart value={d.value} color="#1e3a5f" />
                <div style={s.donutLegend}>
                  <span style={{ ...s.donutDot, background: "#1e3a5f" }} />
                  <span>{d.value.toFixed(1)}%</span>
                  <span style={{ ...s.donutDot, background: "var(--color-border)", marginLeft: "0.5rem" }} />
                  <span>{(100 - d.value).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* CLIENT KPI CARDS — los que ya tenías */}
          {summary && (
            <div style={s.clientGrid}>
              {CLIENTS.map((c) => {
                const data = summary[c.key];
                return (
                  <div key={c.key} style={s.clientCard}>
                    <div style={s.clientCardHeader}>
                      <span style={s.clientBadge}>{c.label}</span>
                    </div>
                    <div style={s.clientKPIs}>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>
                          {lang === "es" ? "Producción" : "Production"}
                        </span>
                        <span style={s.clientKPIValue}>{data.quantity.toLocaleString()}</span>
                      </div>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>Yield</span>
                        <span style={{
                          ...s.clientKPIValue,
                          color: data.yield_pct >= 98 ? "#10b981" : data.yield_pct >= 95 ? "#f59e0b" : "#ef4444",
                        }}>
                          {data.yield_pct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>Scrap %COGP</span>
                        <span style={{
                          ...s.clientKPIValue,
                          color: data.scrap_cogp_pct <= 2 ? "#10b981" : data.scrap_cogp_pct <= 3 ? "#f59e0b" : "#ef4444",
                        }}>
                          {data.scrap_cogp_pct.toFixed(2)}%
                        </span>
                      </div>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>
                          {lang === "es" ? "Scrap pzs" : "Scrap pcs"}
                        </span>
                        <span style={s.clientKPIValue}>{data.scrap_qty}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CLIENT TABS + KPI BARS + TABLA */}
          {summary && (
  <div style={s.clientSection}>
    <div style={s.clientTabBar}>
      {CLIENTS.map((c) => (
        <button
          key={c.key}
          style={{
            ...s.clientTab,
            ...(activeClient === c.key ? s.clientTabActive : {}),
          }}
          onClick={() => setActiveClient(c.key)}
        >
          {c.label}
        </button>
      ))}
    </div>

    {/* KPI cards con barras */}
    <div style={s.clientTabContent}>
      <ClientBlock data={summary[activeClient]} lang={lang} />
    </div>

    {/* Tabla desplegable */}
    <div style={{ padding: "0 1.25rem 1rem" }}>
      <ProductionTable
        date={selectedDate}
        bu={activeClient}
        mode={viewMode}
        lang={lang}
      />
    </div>

    {/* Gráficas siempre visibles */}
    <div style={{ padding: "0 1.25rem 1.25rem" }}>
      <ProductionCharts
        date={selectedDate}
        bu={activeClient}
        mode={viewMode}
        lang={lang}
      />
    </div>
  </div>
)}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:             { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pageHeader:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" },
  title:            { fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  subtitle:         { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  dateControl:      { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  fieldLabel:       { fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" },
  dateInput:        { padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  viewModeGroup:    { display: "flex", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", overflow: "hidden" },
  viewModeBtn:      { padding: "0.375rem 0.875rem", border: "none", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, borderRight: "1px solid var(--color-border)" },
  viewModeBtnActive:{ background: "var(--color-primary)", color: "#fff", fontWeight: 600 },
  errorBanner:      { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "rgba(220,38,38,0.08)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.875rem" },
  loadingState:     { color: "var(--color-text-secondary)", padding: "3rem", textAlign: "center" },
  safetyBanner:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", flexWrap: "wrap", gap: "1rem" },
  safetyLeft:       { display: "flex", alignItems: "center", gap: "1.5rem" },
  safetyDateBox:    { display: "flex", flexDirection: "column", padding: "0.5rem 1rem", border: "2px solid var(--color-border)", borderRadius: "var(--radius-md)" },
  safetyDateLabel:  { fontSize: "0.7rem", color: "var(--color-text-tertiary)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  safetyDateValue:  { fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-primary)" },
  safetyDaysBlock:  { display: "flex", alignItems: "center", gap: "0.75rem" },
  safetyDaysNumber: { fontSize: "1.5rem", fontWeight: 800, color: "#10b981" },
  safetyDaysUnit:   { fontSize: "1rem", fontWeight: 600, color: "#10b981" },
  safetyDaysLabel:  { fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  safetyRight:      { maxWidth: "300px" },
  safetyNote:       { fontSize: "0.75rem", color: "var(--color-text-tertiary)", fontStyle: "italic" },
  productivityCard: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1.5rem", alignItems: "center", padding: "1.25rem 1.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" },
  prodBarSection:   { display: "flex", flexDirection: "column", gap: "0.5rem" },
  earnedHoursBlock: { display: "flex", alignItems: "center", gap: "0.625rem", paddingLeft: "1rem", borderLeft: "1px solid var(--color-border)" },
  earnedHoursValue: { fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" },
  earnedHoursLabel: { fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  donutGrid:        { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" },
  donutCard:        { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "1.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" },
  donutCardTitle:   { fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", alignSelf: "flex-start" },
  donutLegend:      { display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  donutDot:         { width: "10px", height: "10px", borderRadius: "50%", display: "inline-block" },
  clientGrid:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  clientCard:       { padding: "1.25rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" },
  clientCardHeader: { marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "2px solid var(--color-border)" },
  clientBadge:      { fontSize: "1rem", fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "0.05em" },
  clientKPIs:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" },
  clientKPIItem:    { display: "flex", flexDirection: "column", gap: "0.25rem" },
  clientKPILabel:   { fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  clientKPIValue:   { fontSize: "1.375rem", fontWeight: 800, color: "var(--color-text-primary)" },
  clientSection:    { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  clientTabBar:     { display: "flex", borderBottom: "2px solid var(--color-border)" },
  clientTab:        { flex: 1, padding: "0.875rem", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-secondary)", letterSpacing: "0.05em", borderBottom: "3px solid transparent", marginBottom: "-2px" },
  clientTabActive:  { color: "var(--color-primary)", borderBottomColor: "var(--color-primary)", background: "rgba(59,130,246,0.03)" },
  clientTabContent: { padding: "1.25rem" },
};