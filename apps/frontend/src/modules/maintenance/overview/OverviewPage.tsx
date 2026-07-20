import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings, RefreshCw, Play } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { useMaintenanceData } from "./useMaintenanceData";
import { useDashboardTargets } from "./useDashboardTargets";
import { DateRange } from "./types";
import { resolvePreset } from "../../../components/common/date-presets";
import DateRangeSelector     from "../../../components/common/DateRangeSelector";
import KPISection           from "./KPISection";
import ProductionMetrics    from "./ProductionMetrics";
import OEETrendChart        from "./OEETrendChart";
import DowntimeStackedChart from "./DowntimeStackedChart";
import DashboardTargetsPanel from "./DashboardTargetsPanel";

const TARGETS_EDIT_ROLES = ["admin", "plant_manager", "maintenance_engineer"];
const CHARTS_BREAKPOINT  = 900;

export default function OverviewPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { user } = useAuth();
  const canEditTargets = !!user?.roles?.some((r) => TARGETS_EDIT_ROLES.includes(r.slug));

  // `draftRange` es lo que edita el DateRangeSelector, sin efectos secundarios.
  // `appliedRange` es el rango efectivamente consultado — solo cambia al presionar "Cargar".
  // La carga inicial sí es automática (ambos arrancan iguales); los cambios
  // posteriores de fecha los gobierna el botón, no el hook.
  const [draftRange,   setDraftRange]   = useState<DateRange>(() => resolvePreset("today"));
  const [appliedRange, setAppliedRange] = useState<DateRange>(() => resolvePreset("today"));
  const { kpis, oee, oeeTrend, downtimeMonth, loading, error } = useMaintenanceData(appliedRange);
  const { targets, getTarget, refetch: refetchTargets } = useDashboardTargets();

  // Panel de targets
  const [targetsPanelOpen, setTargetsPanelOpen] = useState(false);

  // Breakpoint de gráficas — primer precedente de resize listener en el proyecto
  // (no hay framework CSS con media queries en JS, se maneja localmente aquí)
  const [narrowCharts, setNarrowCharts] = useState(window.innerWidth < CHARTS_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setNarrowCharts(window.innerWidth < CHARTS_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const s = styles;

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* HEADER — pegado al TopBar (ver s.header: cancela el padding de main.content) */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{lang === "es" ? "Mantenimiento — Overview" : "Maintenance Overview"}</h1>
        </div>
        <div style={s.dateControls}>
          <DateRangeSelector value={draftRange} onChange={setDraftRange} defaultPreset="today" />
          <button
            type="button"
            onClick={() => setAppliedRange(draftRange)}
            disabled={loading}
            style={{ ...s.loadBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "default" : "pointer" }}
          >
            {loading ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={16} />}
            <span>{lang === "es" ? "Cargar" : "Load"}</span>
          </button>
          {canEditTargets && (
            <button
              type="button"
              onClick={() => setTargetsPanelOpen(true)}
              style={s.settingsBtn}
              title={lang === "es" ? "Configurar targets" : "Configure targets"}
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {loading ? (
        <div style={s.loading}>{lang === "es" ? "Cargando datos..." : "Loading data..."}</div>
      ) : (
        <>
          <KPISection      kpis={kpis} oee={oee} lang={lang} getTarget={getTarget} />
          <ProductionMetrics kpis={kpis} lang={lang} getTarget={getTarget} />
          <div style={{ display: "grid", gridTemplateColumns: narrowCharts ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <OEETrendChart   data={oeeTrend} lang={lang} compact dayRange={appliedRange} />
            <DowntimeStackedChart data={downtimeMonth} lang={lang} compact dayRange={appliedRange} />
          </div>
        </>
      )}

      {targetsPanelOpen && (
        <DashboardTargetsPanel
          targets={targets}
          lang={lang}
          onClose={() => setTargetsPanelOpen(false)}
          onSaved={refetchTargets}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:          { display: "flex", flexDirection: "column", gap: "1rem" },
  header:        {
    // El padre real con scroll es main.content en AppShell.tsx (padding: 1.5rem 2rem),
    // y ese padding no forma parte del área que un sticky hijo puede "comerse" —
    // por eso top:0 solo no bastaba para pegar el header al TopBar sin gap.
    // Se cancela ese padding con margin negativo y se recupera como padding propio,
    // así el header arranca en el borde real del área de scroll.
    display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem",
    position: "sticky", top: 0, zIndex: 10,
    margin: "-1.5rem -2rem 0",
    padding: "1.5rem 2rem 1rem",
    background: "var(--color-bg)",
  },
  settingsBtn:   { display: "flex", alignItems: "center", justifyContent: "center", padding: "0.375rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer" },
  loadBtn:       { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4375rem 1rem", background: "var(--color-primary, #3b82f6)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.8125rem", fontWeight: 600 },
  title:         { fontSize: "1.375rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  subtitle:      { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  dateControls:  { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  fieldLabel:    { fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontWeight: 500 },
  dateInput:     { padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  errorBanner:   { padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" },
  loading:       { padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" },
};