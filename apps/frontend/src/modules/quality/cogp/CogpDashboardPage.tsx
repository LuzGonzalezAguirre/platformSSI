import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CogpService, CogpWeeklyTrendResponse, CogpParetoResponse, CogpPeriod } from "../services/cogp.service";
import CogpTrendChart from "./CogpTrendChart";
import CogpParetoChart from "./CogpParetoChart";

const todayStr = (): string => new Date().toISOString().slice(0, 10);

function getPreset(mode: "month" | "quarter" | "year"): [string, string] {
  const d = new Date();
  const end = todayStr();
  if (mode === "month")   { d.setMonth(d.getMonth() - 1);     return [d.toISOString().slice(0, 10), end]; }
  if (mode === "quarter") { d.setMonth(d.getMonth() - 3);     return [d.toISOString().slice(0, 10), end]; }
  d.setFullYear(d.getFullYear() - 1);                          return [d.toISOString().slice(0, 10), end];
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

const inputStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem", fontSize: "0.75rem",
  borderRadius: "var(--radius-sm, 6px)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
};

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: 600,
    borderRadius: "var(--radius-sm, 6px)", cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: active ? "#3b82f6" : "var(--color-surface)",
    color:      active ? "#fff"    : "var(--color-text-secondary)",
  };
}

function latestPct(points: { cogp_pct: string | null }[]): number | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1].cogp_pct;
  return last !== null ? parseFloat(last) : null;
}

function CogpCard({ title, points, color }: {
  title: string; points: CogpWeeklyTrendResponse["volvo"]; color: string;
}) {
  const { t } = useTranslation();
  const pct = latestPct(points);
  const pctColor = pct === null ? "var(--color-text-secondary)" : pct <= 2 ? "#10b981" : "#ef4444";

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <div style={cardTitle}>{title}</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: pctColor }}>
          {pct === null ? "—" : `${pct.toFixed(2)}%`}
          <span style={{ fontSize: "0.65rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.35rem" }}>
            {t("cogpDashboard.latestWeek")}
          </span>
        </div>
      </div>
      <CogpTrendChart points={points} color={color} />
    </div>
  );
}

function CogpParetoCard({ title, bucket }: { title: string; bucket: CogpParetoResponse["volvo"] | null }) {
  return (
    <div style={card}>
      <div style={cardTitle}>{title}</div>
      {bucket ? <CogpParetoChart bucket={bucket} /> : (
        <div style={{ color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>...</div>
      )}
    </div>
  );
}

export default function CogpDashboardPage() {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState<string>(getPreset("month")[0]);
  const [endDate,   setEndDate]   = useState<string>(todayStr());
  const [data,      setData]      = useState<CogpWeeklyTrendResponse | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const [paretoPeriod, setParetoPeriod] = useState<CogpPeriod>("week");
  const [paretoDate,   setParetoDate]   = useState<string>(todayStr());
  const [paretoData,   setParetoData]   = useState<CogpParetoResponse | null>(null);
  const [paretoLoading, setParetoLoading] = useState(false);
  const [paretoError,   setParetoError]   = useState<string | null>(null);

  const applyPreset = (m: "month" | "quarter" | "year") => {
    const [s, e] = getPreset(m);
    setStartDate(s);
    setEndDate(e);
  };

  const load = useCallback(async (s = startDate, e = endDate) => {
    setLoading(true);
    setError(null);
    try {
      const result = await CogpService.getWeeklyTrend(s, e);
      setData(result);
    } catch {
      setError(t("cogpDashboard.loadError"));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, t]);

  const loadPareto = useCallback(async (period = paretoPeriod, date = paretoDate) => {
    setParetoLoading(true);
    setParetoError(null);
    try {
      const result = await CogpService.getPareto(period, date);
      setParetoData(result);
    } catch {
      setParetoError(t("cogpDashboard.loadError"));
    } finally {
      setParetoLoading(false);
    }
  }, [paretoPeriod, paretoDate, t]);

  useEffect(() => { load(startDate, endDate); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadPareto(paretoPeriod, paretoDate); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── HEADER TENDENCIA ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            {t("cogpDashboard.title")}
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.2rem 0 0" }}>
            {t("cogpDashboard.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {(["month", "quarter", "year"] as const).map(m => (
              <button key={m} style={toggleStyle(false)} onClick={() => applyPreset(m)}>
                {t(`cogpDashboard.presets.${m}`)}
              </button>
            ))}
          </div>

          <input type="date" value={startDate} max={endDate} style={inputStyle} onChange={e => setStartDate(e.target.value)} />
          <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>→</span>
          <input type="date" value={endDate} max={todayStr()} style={inputStyle} onChange={e => setEndDate(e.target.value)} />

          <button onClick={() => load(startDate, endDate)} disabled={loading}
            style={{ ...inputStyle, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
            {loading ? "..." : "↻"}
          </button>
        </div>
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
          <CogpCard title={t("cogpDashboard.businessUnits.volvo")}   points={data.volvo}   color="#3b82f6" />
          <CogpCard title={t("cogpDashboard.businessUnits.cummins")} points={data.cummins} color="#f59e0b" />
          <CogpCard title={t("cogpDashboard.businessUnits.tulc")}    points={data.tulc}    color="#8b5cf6" />
          <CogpCard title={t("cogpDashboard.businessUnits.global")}  points={data.global}  color="#10b981" />
        </div>
      )}

      {/* ── HEADER PARETO ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            {t("cogpPareto.title")}
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.2rem 0 0" }}>
            {t("cogpPareto.subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {(["day", "week", "month"] as CogpPeriod[]).map(p => (
              <button key={p} style={toggleStyle(paretoPeriod === p)}
                onClick={() => { setParetoPeriod(p); loadPareto(p, paretoDate); }}>
                {t(`cogpPareto.periods.${p}`)}
              </button>
            ))}
          </div>

          <input type="date" value={paretoDate} max={todayStr()} style={inputStyle}
            onChange={e => { setParetoDate(e.target.value); loadPareto(paretoPeriod, e.target.value); }} />

          <button onClick={() => loadPareto(paretoPeriod, paretoDate)} disabled={paretoLoading}
            style={{ ...inputStyle, fontWeight: 600, cursor: paretoLoading ? "not-allowed" : "pointer", opacity: paretoLoading ? 0.5 : 1 }}>
            {paretoLoading ? "..." : "↻"}
          </button>
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
        <CogpParetoCard title={t("cogpDashboard.businessUnits.volvo")}   bucket={paretoData?.volvo ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.cummins")} bucket={paretoData?.cummins ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.tulc")}    bucket={paretoData?.tulc ?? null} />
        <CogpParetoCard title={t("cogpDashboard.businessUnits.global")}  bucket={paretoData?.global ?? null} />
      </div>
    </div>
  );
}