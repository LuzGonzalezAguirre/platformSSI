import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CogpService, CogpWeeklyTrendResponse, CogpParetoResponse, CogpSettings, CogpScrapTest } from "../services/cogp.service";
import CogpTrendChart from "./CogpTrendChart";
import CogpParetoChart from "./CogpParetoChart";
import FilterBar from "../../../components/common/FilterBar";
import { useStandardFilters } from "../../../components/common/useStandardFilters";
import DateRangeSelector from "../../../components/common/DateRangeSelector";
import { DateRange } from "../../../components/common/date-presets";

import FullscreenPanel from "../../../components/common/FullscreenPanel";
import ActionTrackerActionsButton from "../../../components/common/ActionTrackerActionsButton";
import { useFullscreen } from "../../../components/common/useFullscreen";
import { Maximize2, Settings, ChevronDown, ChevronRight, X } from "lucide-react";

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

const emptyScrapTest: CogpScrapTest = {
  test_run_id: "",
  business_unit: "VOLVO", workcenter: "", part_no: "", part_name: "", reason: "",
  scrap_cost: "3", scrap_qty: "12", production_cost: "100", produced_qty: "88",
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

function CogpCard({ title, points, color, target }: {
  title: string; points: CogpWeeklyTrendResponse["volvo"]; color: string; target: number;
}) {
  const { t, i18n } = useTranslation();
  const { fullscreen, enterFullscreen, exitFullscreen } = useFullscreen();
  const pct = latestPct(points);
  const pctColor = pct === null ? "var(--color-text-secondary)" : pct <= target ? "#10b981" : "#ef4444";

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
      <CogpTrendChart points={points} color={color} height={chartHeight} target={target} />
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

function CogpParetoCard({ title, bucket, costTarget, piecesTarget }: {
  title: string; bucket: CogpParetoResponse["volvo"] | null; costTarget: number; piecesTarget: number;
}) {
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
      {bucket ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 390px), 1fr))", gap: "1.5rem" }}>
        <section style={{ minWidth: 0 }}><h3 style={cardTitle}>{t("cogpPareto.byCost")}</h3><CogpParetoChart bucket={bucket} metric="cost" target={costTarget} /></section>
        <section style={{ minWidth: 0 }}><h3 style={cardTitle}>{t("cogpPareto.byPieces")}</h3><CogpParetoChart bucket={bucket} metric="pieces" target={piecesTarget} /></section>
      </div> : (
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
  const [settings, setSettings] = useState<CogpSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [costDraft, setCostDraft] = useState("2");
  const [piecesDraft, setPiecesDraft] = useState("10");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testDraft, setTestDraft] = useState<CogpScrapTest>(() => ({ ...emptyScrapTest, test_run_id: crypto.randomUUID() }));
  const [testSaving, setTestSaving] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testError, setTestError] = useState("");
  const [openPareto, setOpenPareto] = useState<string[]>([]);
  const costTarget = Number(settings?.cost_target_pct ?? 2);
  const piecesTarget = Number(settings?.pieces_target_pct ?? 10);

  useEffect(() => {
    CogpService.getSettings().then(value => {
      setSettings(value);
      setCostDraft(value.cost_target_pct);
      setPiecesDraft(value.pieces_target_pct);
    }).catch(() => setSettingsError(t("cogpDashboard.loadError")));
  }, [t]);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !settingsSaving) setSettingsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen, settingsSaving]);

  const openSettings = () => {
    setCostDraft(settings?.cost_target_pct ?? "2");
    setPiecesDraft(settings?.pieces_target_pct ?? "10");
    if (settings) setSettingsError("");
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    const cost = Number(costDraft), pieces = Number(piecesDraft);
    if (!Number.isFinite(cost) || !Number.isFinite(pieces) || cost <= 0 || pieces <= 0 || cost > 100 || pieces > 100) {
      setSettingsError(t("cogpPareto.invalidTarget"));
      return;
    }
    setSettingsSaving(true);
    setSettingsError("");
    try {
      const value = await CogpService.updateSettings({ cost_target_pct: costDraft, pieces_target_pct: piecesDraft });
      setSettings(value);
      setSettingsOpen(false);
    } catch {
      setSettingsError(t("cogpPareto.saveError"));
    } finally {
      setSettingsSaving(false);
    }
  };

  const stageCurrentOffenders = async () => {
    setTestSaving(true);
    setTestError("");
    setTestResult("");
    try {
      const result = await CogpService.stageCurrentOffenders({
        start_date: paretoRange.start,
        end_date: paretoRange.end,
        workcenter: applied.workcenter,
      });
      const bus = result.red_business_units.length ? result.red_business_units.join(", ") : t("cogpPareto.noRedBus");
      setTestResult(
        t("cogpPareto.currentOffendersResult", {
          count: result.staged,
          bus,
        })
      );
    } catch (error: any) {
      setTestError(error?.response?.data?.detail || t("cogpPareto.currentOffendersError"));
    } finally {
      setTestSaving(false);
    }
  };

  const submitScrapTest = async (event: React.FormEvent) => {
    event.preventDefault();
    setTestSaving(true);
    setTestError("");
    setTestResult("");
    try {
      const result = await CogpService.createScrapTest(testDraft);
      setTestResult(`${t("cogpPareto.testCreated")}: CCS ${result.source_key} · ${result.processing_status ?? "pending"}`);
    } catch (error: any) {
      setTestError(error?.response?.data?.detail || t("cogpPareto.testError"));
    } finally {
      setTestSaving(false);
    }
  };

  const toggle = (key: string, setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter(previous => previous.includes(key) ? [] : [key]);

  const areas = (["volvo", "cummins", "tulc", "john_deere", "eaton", "global"] as const).map(key => ({
    key, title: t(`cogpDashboard.businessUnits.${key === "john_deere" ? "johnDeere" : key}`),
    color: ({ volvo: "#3b82f6", cummins: "#f59e0b", tulc: "#8b5cf6", john_deere: "#22c55e", eaton: "#ec4899", global: "#10b981" })[key],
  }));

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
          dateAddon={
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <ActionTrackerActionsButton
                actions={paretoData?.actions ?? []}
                lang={i18n.language}
              />
              <button type="button" onClick={openSettings} title={t("cogpPareto.settings")} aria-label={t("cogpPareto.settings")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.4rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface)", color: "var(--color-text-primary)", cursor: "pointer" }}>
                <Settings size={17} />
              </button>
            </div>
          }
        />
      </div>

      {settingsOpen && createPortal(
        <div onMouseDown={event => { if (event.target === event.currentTarget && !settingsSaving) setSettingsOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="cogp-settings-title" style={{ ...card, width: "min(100%, 430px)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 id="cogp-settings-title" style={{ margin: 0, fontSize: "1.1rem" }}>{t("cogpPareto.settings")}</h2>
              <button type="button" disabled={settingsSaving} onClick={() => setSettingsOpen(false)} aria-label={t("common.cancel")}
                style={{ background: "none", border: 0, cursor: "pointer", color: "var(--color-text-primary)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              <label style={{ display: "grid", gap: "0.3rem" }}>{t("cogpPareto.costTarget")}
                <input autoFocus type="number" min="0.01" max="100" step="0.01" value={costDraft} disabled={!settings?.can_edit || settingsSaving} onChange={event => setCostDraft(event.target.value)} style={{ padding: "0.5rem", border: "1px solid var(--color-border)", borderRadius: 6 }} />
              </label>
              <label style={{ display: "grid", gap: "0.3rem" }}>{t("cogpPareto.piecesTarget")}
                <input type="number" min="0.01" max="100" step="0.01" value={piecesDraft} disabled={!settings?.can_edit || settingsSaving} onChange={event => setPiecesDraft(event.target.value)} style={{ padding: "0.5rem", border: "1px solid var(--color-border)", borderRadius: 6 }} />
              </label>
            </div>
            {settingsError && <p role="alert" style={{ color: "#ef4444" }}>{settingsError}</p>}
            <button type="button" disabled={settingsSaving || testSaving} onClick={stageCurrentOffenders}>
              {testSaving ? t("common.loading") : t("cogpPareto.testIntegration")}
            </button>
            {testError && <p role="alert" style={{ color: "#ef4444" }}>{testError}</p>}
            {testResult && <p role="status" style={{ color: "#059669" }}>{testResult}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1.25rem" }}>
              <button type="button" disabled={settingsSaving} onClick={() => setSettingsOpen(false)}>{t("common.cancel")}</button>
              {settings?.can_edit && <button type="button" disabled={settingsSaving} onClick={saveSettings}>{t("common.save")}</button>}
            </div>
          </div>
        </div>, document.body
      )}

      {testOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="scrap-test-title" style={{ ...card, width: "min(100%, 600px)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 id="scrap-test-title">{t("cogpPareto.testIntegration")}</h2>
            <p>{t("cogpPareto.testHelp")}</p>
            <form onSubmit={submitScrapTest} style={{ display: "grid", gap: "0.7rem" }}>
              <label>BU <select value={testDraft.business_unit} onChange={e => setTestDraft({ ...testDraft, business_unit: e.target.value })}>
                {["VOLVO", "CUMMINS", "TULC", "JOHN_DEERE", "EATON"].map(bu => <option key={bu} value={bu}>{bu}</option>)}
              </select></label>
              {([
                ["workcenter", "Workcenter"], ["part_no", t("cogpPareto.testPart")],
                ["part_name", t("cogpPareto.testName")], ["reason", t("cogpPareto.testReason")],
                ["scrap_cost", t("cogpPareto.testCost")], ["scrap_qty", t("cogpPareto.testQty")],
                ["production_cost", t("cogpPareto.testProductionCost")], ["produced_qty", t("cogpPareto.testProductionQty")],
              ] as [keyof CogpScrapTest, string][]).map(([key, label]) => (
                <label key={key} style={{ display: "grid", gap: "0.25rem" }}>{label}
                  <input required={key !== "part_name"} disabled={testSaving} type={key.includes("cost") || key.includes("qty") ? "number" : "text"}
                    min={key.includes("cost") || key.includes("qty") ? "0" : undefined}
                    step={key.includes("cost") ? "0.01" : key.includes("qty") ? "1" : undefined}
                    value={testDraft[key]} onChange={e => setTestDraft({ ...testDraft, [key]: e.target.value })} />
                </label>
              ))}
              {testError && <p role="alert" style={{ color: "#ef4444" }}>{testError}</p>}
              {testResult && <p role="status" style={{ color: "#059669", overflowWrap: "anywhere" }}>{testResult}</p>}
              {testResult && <button type="button" onClick={() => {
                setTestDraft({ ...emptyScrapTest, test_run_id: crypto.randomUUID() }); setTestResult("");
              }}>{t("cogpPareto.testAnother")}</button>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button type="button" disabled={testSaving} onClick={() => setTestOpen(false)}>{t("common.cancel")}</button>
                <button type="submit" disabled={testSaving}>{testSaving ? t("common.loading") : t("cogpPareto.testCreate")}</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

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

      {data && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "1rem" }}>
        {areas.map(area => <CogpCard key={area.key} title={area.title} points={data[area.key]} color={area.color} target={costTarget} />)}
      </div>}

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

      <div style={{ display: "grid", gap: "0.6rem" }}>
        {areas.map(area => <div key={area.key} style={card}>
          <button type="button" aria-expanded={openPareto.includes(area.key)} onClick={() => toggle(area.key, setOpenPareto)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", background: "none", border: 0, cursor: "pointer", color: "var(--color-text-primary)", fontWeight: 700 }}>
            {openPareto.includes(area.key) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{area.title}
          </button>
          {openPareto.includes(area.key) && <div style={{ marginTop: "0.75rem" }}><CogpParetoCard title={area.title} bucket={paretoData?.[area.key] ?? null} costTarget={costTarget} piecesTarget={piecesTarget} /></div>}
        </div>)}
      </div>
    </div>
  );
}
