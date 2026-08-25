import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { useMaintenanceData } from "./useMaintenanceData";
import { useDashboardTargets } from "./useDashboardTargets";
import { useStandardFilters } from "../../../components/common/useStandardFilters";
import FilterBar from "../../../components/common/FilterBar";
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

  // draft/applied ahora vive dentro de useStandardFilters (mismo patrón que
  // antes: editar sin efecto, aplicar con el botón "Cargar" de FilterBar).
  const { draft, setDraft, applied, apply } = useStandardFilters("today");
  const { kpis, oee, oeeTrend, downtimeMonth, loading, error } = useMaintenanceData(applied);
  const { targets, getTarget, refetch: refetchTargets } = useDashboardTargets();

  const [targetsPanelOpen, setTargetsPanelOpen] = useState(false);

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

      <div style={s.header}>
        <div>
          <h1 style={s.title}>{lang === "es" ? "Mantenimiento — Overview" : "Maintenance Overview"}</h1>
        </div>
        <div style={s.controlsRow}>
          <FilterBar draft={draft} setDraft={setDraft} onApply={apply} loading={loading} />
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
            <OEETrendChart   data={oeeTrend} lang={lang} compact dayRange={applied} />
            <DowntimeStackedChart data={downtimeMonth} lang={lang} compact dayRange={applied} />
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
    display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem",
    position: "sticky", top: 0, zIndex: 10,
    margin: "-1.5rem -2rem 0",
    padding: "1.5rem 2rem 1rem",
    background: "var(--color-bg)",
  },
  settingsBtn:   { display: "flex", alignItems: "center", justifyContent: "center", padding: "0.375rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer" },
  title:         { fontSize: "1.375rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  controlsRow:   { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  errorBanner:   { padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" },
  loading:       { padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" },
};