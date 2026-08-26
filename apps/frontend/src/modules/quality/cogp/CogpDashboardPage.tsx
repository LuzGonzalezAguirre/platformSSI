import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CogpService, CogpWeeklyTrendResponse, CogpParetoResponse } from "../services/cogp.service";
import CogpTrendChart from "./CogpTrendChart";
import CogpParetoChart from "./CogpParetoChart";
import FilterBar from "../../../components/common/FilterBar";
import { useStandardFilters } from "../../../components/common/useStandardFilters";
import DateRangeSelector from "../../../components/common/DateRangeSelector";
import { DateRange } from "../../../components/common/date-presets";

import FullscreenPanel from "../../../components/common/FullscreenPanel";
import { useFullscreen } from "../../../components/common/useFullscreen";
import { Maximize2 } from "lucide-react";

function fullscreenBtnStyle(): React.CSSProperties {
  return {
    background: "none", border: "none", cursor: "pointer",
    color: "var(--color-text-secondary)", padding: "0.2rem",
    display: "flex", alignItems: "center",
  };
}

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

function latestPct(points: { cogp_pct: string | null }[]): number | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1].cogp_pct;
  return last !== null ? parseFloat(last) : null;
}

function CogpCard({ title, points, color }: {
  title: string; points: CogpWeeklyTrendResponse["volvo"]; color: string;
}) {
  const { t } = useTranslation();
  const { fullscreen, enterFullscreen, exitFullscreen } = useFullscreen();
  const pct = latestPct(points);
  const pctColor = pct === null ? "var(--color-text-secondary)" : pct <= 2 ? "#10b981" : "#ef4444";

  const chartHeight = fullscreen ? Math.max(window.innerHeight - 260, 420) : undefined;

  const body = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <div style={cardTitle}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: pctColor }}>
            {pct === null ? "—" : `${pct.toFixed(2)}%`}
            <span style={{ fontSize: "0.65rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.35rem" }}>
              {t("cogpDashboard.latestWeek")}
            </span>
          </div>
          {!fullscreen && (
            <button style={fullscreenBtnStyle()} onClick={enterFullscreen} title={t("scrapRate.fullscreen")}>
              <Maximize2 size={15} />
            </button>
          )}
        </div>
      </div>
      <CogpTrendChart points={points} color={color} height={chartHeight} />
    </>
  );

  if (fullscreen) {
    return (
      <FullscreenPanel title={title} onExit={exitFullscreen}>
        {body}
      </FullscreenPanel>
    );
  }

  return <div style={card}>{body}</div>;
}

function CogpParetoCard({ title, bucket }: { title: string; bucket: CogpParetoResponse["volvo"] | null }) {
  const { t } = useTranslation();
  const { fullscreen, enterFullscreen, exitFullscreen } = useFullscreen();

  const body = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div style={cardTitle}>{title}</div>
        {!fullscreen && (
          <button style={fullscreenBtnStyle()} onClick={enterFullscreen} title={t("scrapRate.fullscreen")}>
            <Maximize2 size={15} />
          </button>
        )}
      </div>
      {bucket ? <CogpParetoChart bucket={bucket} /> : (
        <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>...</div>
      )}
    </>
  );

  if (fullscreen) {
    return (
      <FullscreenPanel title={title} onExit={exitFullscreen}>
        {body}
      </FullscreenPanel>
    );
  }

  return <div style={card}>{body}</div>;
}

export default function CogpDashboardPage() {
  const { t } = useTranslation();

  const { draft, setDraft, applied, apply } = useStandardFilters("month_to_date");

  const [data,    setData]    = useState<CogpWeeklyTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Rango de Pareto: null = sigue al filtro general (comportamiento default).
  // Se fija con valor propio cuando el usuario elige fechas distintas en su
  // propio DateRangeSelector; se resetea a null cada vez que se vuelve a
  // aplicar el filtro general, para no quedar "pegado" a una fecha vieja.
  const [paretoRangeOverride, setParetoRangeOverride] = useState<DateRange | null>(null);
  const paretoRange: DateRange = paretoRangeOverride ?? { start: applied.start, end: applied.end };
  const isParetoOverridden = paretoRangeOverride !== null;

  const [paretoData,    setParetoData]    = useState<CogpParetoResponse | null>(null);
  const [paretoLoading, setParetoLoading] = useState(false);
  const [paretoError,   setParetoError]   = useState<string | null>(null);

  const loadTrend = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CogpService.getWeeklyTrend(applied.start, applied.end, applied.workcenter);
      setData(result);
    } catch {
      setError(t("cogpDashboard.loadError"));
    } finally {
      setLoading(false);
    }
  }, [applied, t]);

  const loadPareto = useCallback(async (range: DateRange) => {
    setParetoLoading(true);
    setParetoError(null);
    try {
      const result = await CogpService.getPareto(range.start, range.end, applied.workcenter);
      setParetoData(result);
    } catch {
      setParetoError(t("cogpDashboard.loadError"));
    } finally {
      setParetoLoading(false);
    }
  }, [applied.workcenter, t]);

  // Filtro general aplicado -> recarga Trend y resincroniza Pareto.
  useEffect(() => {
    loadTrend();
    setParetoRangeOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  // Pareto se recarga cuando su rango efectivo cambia (sigue al general,
  // o al override propio).
  useEffect(() => {
    loadPareto(paretoRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paretoRange.start, paretoRange.end, applied.workcenter]);

  const handleApply = () => {
    apply();
  };

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── HEADER + FILTROS COMPARTIDOS ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            {t("cogpDashboard.title")}
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.2rem 0 0" }}>
            {t("cogpDashboard.subtitle")}
          </p>
        </div>

        <FilterBar
          draft={draft}
          setDraft={setDraft}
          onApply={handleApply}
          loading={loading || paretoLoading}
          showBU={false}
          showShift={false}
          filterScope="cogp"
        />
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "8px", color: "#ef4444", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          {t("common.loading")}
        </div>
      )}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1rem" }}>
          <CogpCard title={t("cogpDashboard.businessUnits.volvo")}      points={data.volvo}      color="#3b82f6" />
          <CogpCard title={t("cogpDashboard.businessUnits.cummins")}    points={data.cummins}    color="#f59e0b" />
          <CogpCard title={t("cogpDashboard.businessUnits.tulc")}       points={data.tulc}       color="#8b5cf6" />
          <CogpCard title={t("cogpDashboard.businessUnits.johnDeere")}  points={data.john_deere} color="#22c55e" />
          <CogpCard title={t("cogpDashboard.businessUnits.eaton")}      points={data.eaton}      color="#ec4899" />
          <CogpCard title={t("cogpDashboard.businessUnits.global")}     points={data.global}     color="#10b981" />
        </div>
      )}

      {/* ── HEADER PARETO — rango propio, independiente del general ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            {t("cogpPareto.title")}
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.2rem 0 0" }}>
            {t("cogpPareto.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
          <DateRangeSelector
            value={paretoRange}
            onChange={(range) => setParetoRangeOverride(range)}
            defaultPreset="custom"
          />
          {isParetoOverridden && (
            <button
              type="button"
              onClick={() => setParetoRangeOverride(null)}
              style={{
                fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary, #3b82f6)",
                background: "none", border: "none", cursor: "pointer", textDecoration: "underline",
              }}
            >
              {t("cogpPareto.useMainRange")}
            </button>
          )}
        </div>
      </div>

      {paretoData && (
        <p style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", margin: 0 }}>
          {paretoData.start_date} → {paretoData.end_date}
        </p>
      )}

      {paretoError && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "8px", color: "#ef4444", fontSize: "0.85rem" }}>
          {paretoError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "1rem" }}>
        <CogpParetoCard title={t("cogpDashboard.businessUnits.volvo")}      bucket={paretoData?.volvo ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.cummins")}    bucket={paretoData?.cummins ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.tulc")}       bucket={paretoData?.tulc ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.johnDeere")}  bucket={paretoData?.john_deere ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.eaton")}      bucket={paretoData?.eaton ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.global")}     bucket={paretoData?.global ?? null} />
      </div>
    </div>
  );
}