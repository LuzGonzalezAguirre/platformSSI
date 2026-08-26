import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Clock, Download, FileText } from "lucide-react";
import { OpsReportService } from "./ops-report.service";
import { MaintenanceService } from "../../maintenance/overview/overview.service";
import { OEEData } from "../../maintenance/overview/types";
import { DailySummary, ClientMetrics, ViewMode, BusinessUnitOption } from "./types";
import { SafetyService } from "../safety/safety.service";
import { SafetySettings } from "../safety/types";
import { AssistanceService } from "../assistance/assistance.service";
import ProductionTable from "./ProductionTable";
import ProductionCharts from "./ProductionCharts";
import type { DailyProductivity } from "../assistance/types";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

type OEELiveData = OEEData & { source?: "manual" | "plex" };

function getPeriodRange(mode: ViewMode, selectedDate: string): { start: string; end: string } {
  if (mode === "daily") return { start: selectedDate, end: selectedDate };
  const d = new Date(selectedDate + "T12:00:00");
  if (mode === "weekly") {
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    return { start: monday.toISOString().split("T")[0], end: selectedDate };
  }
  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  return { start: firstOfMonth.toISOString().split("T")[0], end: selectedDate };
}

interface DonutProps { value: number | null; color: string; size?: number; }

function DonutChart({ value, color, size = 160 }: DonutProps) {
  const radius = 54;
  const stroke = 12;
  const circ   = 2 * Math.PI * radius;
  const hasData = value !== null;
  const filled = hasData ? Math.min((value / 100) * circ, circ) : 0;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        {hasData && (
          <circle
            cx={cx} cy={cy} r={radius} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "1.25rem", fontWeight: 800, color: hasData ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
          {hasData ? `${value.toFixed(1)}%` : "—"}
        </span>
      </div>
    </div>
  );
}

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
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>{label}</span>
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

function ClientBlock({ data, lang }: { data: ClientMetrics; lang: "es" | "en" }) {
  const wipPct = data.wip_goal > 0 ? Math.min((data.wip_actual / data.wip_goal) * 100, 100) : 0;
  const wipColor = data.wip_actual <= data.wip_goal * 0.8 ? "#10b981" : data.wip_actual <= data.wip_goal ? "#f59e0b" : "#ef4444";
  const s = clientStyles;

  return (
    <div style={s.block}>
      <div style={s.kpiGrid}>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>{lang === "es" ? "Producción" : "Production"}</div>
          <div style={s.kpiMain}>
            <span style={{ ...s.kpiValue, color: data.production_pct >= 100 ? "#10b981" : data.production_pct >= 90 ? "#f59e0b" : "#ef4444" }}>
              {data.production_pct.toFixed(1)}%
            </span>
          </div>
          <div style={s.kpiSub}>
            {data.quantity.toLocaleString()} / {data.target.toLocaleString()} {lang === "es" ? "pzas" : "pcs"}
          </div>
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width: `${Math.min(data.production_pct, 100)}%`, background: data.production_pct >= 100 ? "#10b981" : data.production_pct >= 90 ? "#f59e0b" : "#ef4444" }} />
            <div style={{ ...s.barTarget, left: "100%" }} />
          </div>
          <div style={s.barLabels}>
            <span>Target: {data.target.toLocaleString()}</span>
            <span style={{ color: data.production_pct >= 100 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
              {data.production_pct >= 100 ? "✓" : `${(data.quantity - data.target).toLocaleString()} pcs`}
            </span>
          </div>
        </div>

        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>WIP (Line)</div>
          <div style={s.kpiMain}>
            <span style={{ ...s.kpiValue, color: wipColor }}>{data.wip_actual.toLocaleString()}</span>
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

        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Yield</div>
          <div style={s.kpiMain}>
            <span style={{ ...s.kpiValue, color: data.yield_pct >= 98 ? "#10b981" : data.yield_pct >= 95 ? "#f59e0b" : "#ef4444" }}>
              {data.yield_pct.toFixed(1)}%
            </span>
          </div>
          <div style={s.kpiSub}>Target ≥ 98%</div>
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width: `${Math.min(data.yield_pct, 100)}%`, background: data.yield_pct >= 98 ? "#10b981" : data.yield_pct >= 95 ? "#f59e0b" : "#ef4444" }} />
            <div style={{ ...s.barTarget, left: "98%" }} />
          </div>
          <div style={s.barLabels}>
            <span>Target: 98%</span>
            <span style={{ color: data.yield_pct >= 98 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
              {(data.yield_pct - 98).toFixed(1)} pp
            </span>
          </div>
        </div>

        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Scrap %COGP</div>
          <div style={s.kpiMain}>
            <span style={{ ...s.kpiValue, color: data.scrap_cogp_pct <= 2 ? "#10b981" : data.scrap_cogp_pct <= 3 ? "#f59e0b" : "#ef4444" }}>
              {data.scrap_cogp_pct.toFixed(2)}%
            </span>
          </div>
          <div style={s.kpiSub}>{data.scrap_qty} {lang === "es" ? "pzas scrap" : "scrap pcs"}</div>
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width: `${Math.min((data.scrap_cogp_pct / 4) * 100, 100)}%`, background: data.scrap_cogp_pct <= 2 ? "#10b981" : data.scrap_cogp_pct <= 3 ? "#f59e0b" : "#ef4444" }} />
            <div style={{ ...s.barTarget, left: "50%" }} />
          </div>
          <div style={s.barLabels}>
            <span>Target: &lt; 2%</span>
            <span style={{ color: data.scrap_cogp_pct <= 2 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
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

export default function OpsReportPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode]         = useState<ViewMode>("daily");
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [activeClient, setActiveClient] = useState<string>("volvo");
  const [summary, setSummary]           = useState<DailySummary | null>(null);
  const [safety, setSafety]             = useState<SafetySettings | null>(null);
  const [productivity, setProductivity] = useState<DailyProductivity | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const [oeeData, setOeeData] = useState<OEELiveData | null>(null);

  // Catalogo de BUs activas, una sola vez -- fuente de verdad para tarjetas
  // y tabs. Si el negocio da de alta una BU nueva en Targets Config,
  // aparece aqui solo, sin tocar codigo (ver decision del backend, mismo
  // criterio de loop dinamico).
  useEffect(() => {
    OpsReportService.getBusinessUnits()
      .then((bus) => setBusinessUnits(bus.filter((b) => b.is_active)))
      .catch(() => setBusinessUnits([]));
  }, []);

  const loadOEE = useCallback(async (date: string, mode: ViewMode) => {
    const { start, end } = getPeriodRange(mode, date);
    try {
      const data = await MaintenanceService.getOEELive(start, end);
      setOeeData(data as OEELiveData | null);
    } catch {
      setOeeData(null);
    }
  }, []);

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
        const prod = await AssistanceService.getDailyProductivity(selectedDate);
        setProductivity(prod);
      } catch {
        setProductivity(null);
      }

      await loadOEE(selectedDate, viewMode);
    } catch (e: any) {
      setError(e?.response?.data?.detail || (lang === "es" ? "Error cargando datos" : "Error loading data"));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode, lang, loadOEE]);

  useEffect(() => { load(); }, [load]);

  const paidHours       = productivity?.paid_hours       ? parseFloat(productivity.paid_hours)       : 0;
  const earnedHours     = productivity?.earned_hours     ? parseFloat(productivity.earned_hours)     : 0;
  const productivityPct = productivity?.productivity_pct ? parseFloat(productivity.productivity_pct) : 0;
  const attendanceSaved = productivity?.attendance_saved ?? false;
  const hasManualEarned = productivity?.earned_hours != null;

  const generalYield = summary?.total.yield_pct ?? 0;

  const oeePct         = oeeData ? parseFloat(oeeData.oee_pct)          : null;
  const availPct       = oeeData ? parseFloat(oeeData.availability_pct) : null;
  const performancePct = oeeData ? parseFloat(oeeData.performance_pct)  : null;
  const qualityPct     = oeeData ? parseFloat(oeeData.quality_pct)      : null;
  const oeeSource      = oeeData?.source ?? null;

  const { start: periodStart, end: periodEnd } = getPeriodRange(viewMode, selectedDate);

  const s = styles;

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.title}>{lang === "es" ? "Reporte Diario Ops" : "Ops Daily Report"}</h1>
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
                style={{ ...s.viewModeBtn, ...(viewMode === m ? s.viewModeBtnActive : {}) }}
                onClick={() => setViewMode(m)}
              >
                {m === "daily" ? (lang === "es" ? "Diario" : "Daily")
                  : m === "weekly" ? (lang === "es" ? "Semanal" : "Weekly")
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

          <div style={s.productivityCard}>
            <div style={s.prodBarSection}>
              <KPIBar
                label={lang === "es" ? "Productividad" : "Productivity"}
                value={productivityPct} target={85}
                subLabel={attendanceSaved
                  ? `${earnedHours.toFixed(1)} / ${paidHours.toFixed(1)} hrs`
                  : (lang === "es" ? "sin asistencia" : "no attendance")}
              />
            </div>
            <div style={s.prodBarSection}>
              <KPIBar label={lang === "es" ? "Yield General" : "General Yield"} value={generalYield} target={98} />
            </div>
            <div style={s.prodBarSection}>
              <KPIBar label="OEE" value={oeePct ?? 0} target={65} />
            </div>
            <div style={s.earnedHoursBlock}>
              <Clock size={16} color="var(--color-text-secondary)" />
              <div>
                <div style={s.earnedHoursValue}>
                  {attendanceSaved ? `${earnedHours.toFixed(1)} / ${paidHours.toFixed(1)}` : "—"}
                </div>
                <div style={s.earnedHoursLabel}>
                  {attendanceSaved
                    ? (lang === "es" ? "Horas ganadas / pagadas" : "Earned / Paid Hours")
                    : (lang === "es" ? "Sin asistencia capturada" : "Attendance not captured")}
                  {hasManualEarned && attendanceSaved && (
                    <span style={{ marginLeft: "0.375rem", color: "#3b82f6", fontSize: "0.7rem" }}>(manual)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={s.donutSectionHeader}>
            <span style={s.donutRangeLabel}>
              {periodStart === periodEnd ? periodStart : `${periodStart} → ${periodEnd}`}
            </span>
            {oeeSource && (
              <span style={{
                ...s.sourceBadge,
                background: oeeSource === "manual" ? "rgba(59,130,246,0.1)" : "rgba(16,185,129,0.1)",
                color: oeeSource === "manual" ? "#3b82f6" : "#10b981",
              }}>
                {oeeSource === "manual"
                  ? (lang === "es" ? "Override manual" : "Manual override")
                  : (lang === "es" ? "Vivo (Plex)" : "Live (Plex)")}
              </span>
            )}
          </div>
          <div style={s.donutGrid}>
            {[
              { label: lang === "es" ? "Disponibilidad" : "Availability", value: availPct },
              { label: "SSI Performance", value: performancePct },
              { label: lang === "es" ? "Calidad" : "Quality", value: qualityPct },
            ].map((d) => (
              <div key={d.label} style={s.donutCard}>
                <div style={s.donutCardTitle}>{d.label}</div>
                <DonutChart value={d.value} color="#1e3a5f" />
                <div style={s.donutLegend}>
                  <span style={{ ...s.donutDot, background: "#1e3a5f" }} />
                  <span>{d.value !== null ? `${d.value.toFixed(1)}%` : "—"}</span>
                  <span style={{ ...s.donutDot, background: "var(--color-border)", marginLeft: "0.5rem" }} />
                  <span>{d.value !== null ? `${(100 - d.value).toFixed(1)}%` : "—"}</span>
                </div>
              </div>
            ))}
          </div>

          {summary && businessUnits.length > 0 && (
            <div style={s.clientGrid}>
              {businessUnits.map((bu) => {
                const data = summary[bu.code] as ClientMetrics | undefined;
                if (!data) return null;
                return (
                  <div key={bu.code} style={s.clientCard}>
                    <div style={s.clientCardHeader}>
                      <span style={s.clientBadge}>{bu.name.toUpperCase()}</span>
                    </div>
                    <div style={s.clientKPIs}>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>{lang === "es" ? "Producción" : "Production"}</span>
                        <span style={s.clientKPIValue}>{data.quantity.toLocaleString()}</span>
                      </div>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>Yield</span>
                        <span style={{ ...s.clientKPIValue, color: data.yield_pct >= 98 ? "#10b981" : data.yield_pct >= 95 ? "#f59e0b" : "#ef4444" }}>
                          {data.yield_pct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>Scrap %COGP</span>
                        <span style={{ ...s.clientKPIValue, color: data.scrap_cogp_pct <= 2 ? "#10b981" : data.scrap_cogp_pct <= 3 ? "#f59e0b" : "#ef4444" }}>
                          {data.scrap_cogp_pct.toFixed(2)}%
                        </span>
                      </div>
                      <div style={s.clientKPIItem}>
                        <span style={s.clientKPILabel}>{lang === "es" ? "Scrap pzs" : "Scrap pcs"}</span>
                        <span style={s.clientKPIValue}>{data.scrap_qty}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {summary && businessUnits.length > 0 && (
            <div style={s.clientSection}>
              <div style={s.clientTabBar}>
                {businessUnits.map((bu) => (
                  <button
                    key={bu.code}
                    style={{ ...s.clientTab, ...(activeClient === bu.code ? s.clientTabActive : {}) }}
                    onClick={() => setActiveClient(bu.code)}
                  >
                    {bu.name.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={s.clientTabContent}>
                {summary[activeClient] && (
                  <ClientBlock data={summary[activeClient] as ClientMetrics} lang={lang} />
                )}
              </div>
              <div style={{ padding: "0 1.25rem 1rem" }}>
                <ProductionTable date={selectedDate} bu={activeClient} mode={viewMode} lang={lang} />
              </div>
              <div style={{ padding: "0 1.25rem 1.25rem" }}>
                <ProductionCharts date={selectedDate} bu={activeClient} mode={viewMode} lang={lang} />
              </div>
            </div>
          )}

          {summary && viewMode === "daily" && (
            <div style={{ padding: "1rem 1.25rem 2rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.625rem 1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid #10b981",
                  background: "rgba(16,185,129,0.08)",
                  color: "#10b981",
                  cursor: "pointer", fontSize: "0.875rem", fontWeight: 600,
                }}
                onClick={async () => {
                  try {
                    await OpsReportService.exportDailyExcel(selectedDate);
                  } catch {
                    alert(lang === "es" ? "Error generando Excel" : "Error generating Excel");
                  }
                }}
              >
                <Download size={16} />
                {lang === "es" ? "Descargar Reporte Excel" : "Download Excel Report"}
              </button>

              <button
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.625rem 1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid #ef4444",
                  background: "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                  cursor: "pointer", fontSize: "0.875rem", fontWeight: 600,
                }}
                onClick={async () => {
                  try {
                    await OpsReportService.exportDailyPDF(selectedDate);
                  } catch {
                    alert(lang === "es" ? "Error generando PDF" : "Error generating PDF");
                  }
                }}
              >
                <FileText size={16} />
                {lang === "es" ? "Descargar PDF" : "Download PDF"}
              </button>
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
  donutSectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  donutRangeLabel:  { fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" },
  sourceBadge:      { fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.625rem", borderRadius: "999px" },
  donutGrid:        { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" },
  donutCard:        { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "1.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" },
  donutCardTitle:   { fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", alignSelf: "flex-start" },
  donutLegend:      { display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  donutDot:         { width: "10px", height: "10px", borderRadius: "50%", display: "inline-block" },
  clientGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" },
  clientCard: { padding: "1rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" },
  clientBadge:      { fontSize: "1rem", fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "0.05em" },
  clientKPIs:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" },
  clientKPIItem:    { display: "flex", flexDirection: "column", gap: "0.25rem" },
  clientKPILabel:   { fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  clientKPIValue: { fontSize: "1.125rem", fontWeight: 800, color: "var(--color-text-primary)" },
  clientSection:    { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  clientTabBar:     { display: "flex", borderBottom: "2px solid var(--color-border)" },
  clientTab:        { flex: 1, padding: "0.875rem", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-secondary)", letterSpacing: "0.05em", borderBottom: "3px solid transparent", marginBottom: "-2px" },
  clientTabActive:  { color: "var(--color-primary)", borderBottomColor: "var(--color-primary)", background: "rgba(59,130,246,0.03)" },
  clientTabContent: { padding: "1.25rem" },
};