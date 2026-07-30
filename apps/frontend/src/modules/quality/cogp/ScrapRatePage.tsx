import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  CogpService,
  ScrapRateResponse,
  ScrapRateBusinessUnit,
} from "../services/cogp.service";
import ScrapRateComboChart from "./ScrapRateComboChart";

const BU_OPTIONS: ScrapRateBusinessUnit[] = ["GLOBAL", "VOLVO", "CUMMINS", "TULC"];

const todayStr = (): string => new Date().toISOString().slice(0, 10);

function mondayOffset(weeksBack: number): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day - weeksBack * 7);
  return d.toISOString().slice(0, 10);
}

function ytdStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

type Preset = "ytd" | "w13" | "w26" | "w52";

function presetRange(p: Preset): [string, string] {
  const end = todayStr();
  if (p === "ytd") return [ytdStart(), end];
  if (p === "w13") return [mondayOffset(12), end];
  if (p === "w26") return [mondayOffset(25), end];
  return [mondayOffset(51), end];
}

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg, 10px)",
  padding: "1.25rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.6rem",
  fontSize: "0.78rem",
  borderRadius: "var(--radius-sm, 6px)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
};

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.35rem 0.85rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    borderRadius: "var(--radius-sm, 6px)",
    cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: active ? "#3b82f6" : "var(--color-surface)",
    color: active ? "#fff" : "var(--color-text-secondary)",
    whiteSpace: "nowrap",
  };
}

function KpiTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: "140px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md, 8px)",
        padding: "0.7rem 0.9rem",
      }}
    >
      <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800, color: color ?? "var(--color-text-primary)", marginTop: "0.15rem" }}>
        {value}
      </div>
    </div>
  );
}

export default function ScrapRatePage() {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState<string>(presetRange("ytd")[0]);
  const [endDate, setEndDate] = useState<string>(todayStr());
  const [businessUnit, setBusinessUnit] = useState<ScrapRateBusinessUnit>("GLOBAL");
  const [data, setData] = useState<ScrapRateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(
    async (s: string, e: string, bu: ScrapRateBusinessUnit) => {
      setLoading(true);
      setError(null);
      try {
        const res = await CogpService.getScrapRateWeekly(s, e, bu);
        setData(res);
      } catch (err: any) {
        setError(err?.response?.data?.detail ?? t("scrapRate.loadError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  // Dependencias explicitas y completas: sin esto el efecto se re-dispara
  // en cada render y genera un loop de requests contra el proxy.
  useEffect(() => {
    load(startDate, endDate, businessUnit);
  }, [load, startDate, endDate, businessUnit]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const applyPreset = (p: Preset) => {
    const [s, e] = presetRange(p);
    setStartDate(s);
    setEndDate(e);
  };

  const totals = data?.totals;
  const ratePct = totals?.scrap_rate_pct ? parseFloat(totals.scrap_rate_pct) : null;

  const chart = (
    <ScrapRateComboChart
      weeks={data?.weeks ?? []}
      height={fullscreen ? Math.max(window.innerHeight - 180, 420) : 560}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
          {t("scrapRate.title")}
        </h1>
        <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: "0.2rem" }}>
          {t("scrapRate.subtitle")}
        </div>
      </div>

      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {BU_OPTIONS.map((bu) => (
            <button
              key={bu}
              style={toggleStyle(businessUnit === bu)}
              onClick={() => setBusinessUnit(bu)}
            >
              {t(`scrapRate.businessUnits.${bu.toLowerCase()}`)}
            </button>
          ))}
        </div>

        <div style={{ width: 1, alignSelf: "stretch", background: "var(--color-border)" }} />

        <div style={{ display: "flex", gap: "0.35rem" }}>
          {(["ytd", "w13", "w26", "w52"] as Preset[]).map((p) => (
            <button key={p} style={toggleStyle(false)} onClick={() => applyPreset(p)}>
              {t(`scrapRate.presets.${p}`)}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginLeft: "auto" }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          <span style={{ color: "var(--color-text-secondary)" }}>→</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          <button style={toggleStyle(false)} onClick={() => setFullscreen(true)}>
            {t("scrapRate.fullscreen")}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md, 8px)", padding: "0.75rem 1rem", color: "#b91c1c", fontSize: "0.82rem" }}>
          {error}
        </div>
      )}

      {totals && (
        <div style={{ ...card, display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <KpiTile label={t("scrapRate.kpis.input")} value={totals.input_qty.toLocaleString("en-US")} />
          <KpiTile label={t("scrapRate.kpis.produced")} value={totals.produced_qty.toLocaleString("en-US")} color="#3b82f6" />
          <KpiTile label={t("scrapRate.kpis.scrap")} value={totals.scrap_qty.toLocaleString("en-US")} color="#f97316" />
          <KpiTile
            label={t("scrapRate.kpis.rate")}
            value={ratePct === null ? "—" : `${ratePct.toFixed(2)}%`}
          />
          <KpiTile label={t("scrapRate.kpis.weeks")} value={String(data?.meta.weeks_total ?? 0)} />
        </div>
      )}

      <div style={card}>
        {loading && !data ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
            {t("scrapRate.loading")}
          </div>
        ) : (
          <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.2s" }}>{chart}</div>
        )}

        {data && (
          <div style={{ fontSize: "0.66rem", color: "var(--color-text-secondary)", marginTop: "0.75rem", textAlign: "right" }}>
            {t("scrapRate.meta", {
              range: `${data.start_date} → ${data.end_date}`,
              cache: data.meta.weeks_from_cache,
              plex: data.meta.weeks_from_plex,
            })}
          </div>
        )}
      </div>

      {fullscreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "var(--color-bg)",
            padding: "1.5rem 2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            overflow: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
              {t("scrapRate.title")} · {t(`scrapRate.businessUnits.${businessUnit.toLowerCase()}`)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
              {data?.start_date} → {data?.end_date}
            </div>
            <button style={{ ...toggleStyle(false), marginLeft: "auto" }} onClick={() => setFullscreen(false)}>
              {t("scrapRate.exitFullscreen")}
            </button>
          </div>
          <div style={{ ...card, flex: 1 }}>{chart}</div>
        </div>
      )}
    </div>
  );
}