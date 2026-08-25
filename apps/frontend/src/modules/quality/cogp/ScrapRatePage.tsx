import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  CogpService,
  ScrapRateResponse,
  ScrapRateBusinessUnit,
} from "../services/cogp.service";
import ScrapRateComboChart from "./ScrapRateComboChart";
import BUSelect from "../../../components/common/BUSelect";
import DateRangeSelector, { PresetGroup } from "../../../components/common/DateRangeSelector";
import { DateRange, resolvePreset } from "../../../components/common/date-presets";

// Opciones LOCALES, no vienen de useFilterChoices(): el endpoint compartido
// de choices incluye JOHN_DEERE (ACTIVE_FILTER_BU_CODES), pero
// resolve_bu_for_finished_goods no lo clasifica -- pedirlo devolveria
// ceros silenciosos. Scrap Rate solo entiende los 3 BUs trackeados por
// ScrapRateService.TRACKED_BUS.
const SCRAP_RATE_BU_OPTIONS: ScrapRateBusinessUnit[] = ["VOLVO", "CUMMINS", "TULC"];

// Presets propios de esta pantalla: Scrap Rate es una tendencia semanal de
// hasta 104 semanas (ScrapRateService.MAX_WEEKS), y los grupos incorporados
// de DateRangeSelector topan en 90 dias -- no alcanzan para YTD ni para
// 26/52 semanas, que eran el uso principal de este reporte.
const SCRAP_RATE_EXTRA_PRESET_GROUPS: PresetGroup[] = [
  {
    title_es: "Tendencia", title_en: "Trend",
    options: [
      { preset: "year_to_date",   es: "Año a la Fecha",     en: "Year to Date" },
      { preset: "last_26_weeks",  es: "Últimas 26 Semanas", en: "Last 26 Weeks" },
      { preset: "last_52_weeks",  es: "Últimas 52 Semanas", en: "Last 52 Weeks" },
    ],
  },
];

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg, 10px)",
  padding: "1.25rem",
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

  const [dateRange, setDateRange] = useState<DateRange>(() => resolvePreset("last_90_days"));
  // Vacio = "sin filtro" = el backend suma los 3 BUs trackeados. Mismo
  // significado que tenia el sentinel "GLOBAL" antes, pero ahora expresado
  // como ausencia de seleccion en vez de un cuarto valor especial.
  const [businessUnits, setBusinessUnits] = useState<ScrapRateBusinessUnit[]>([]);
  const [data, setData] = useState<ScrapRateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(
    async (range: DateRange, bus: ScrapRateBusinessUnit[]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await CogpService.getScrapRateWeekly(range.start, range.end, bus);
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
    load(dateRange, businessUnits);
  }, [load, dateRange, businessUnits]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const totals = data?.totals;
  const ratePct = totals?.scrap_rate_pct ? parseFloat(totals.scrap_rate_pct) : null;

  // Label legible para el titulo de fullscreen. business_units en la
  // respuesta ya viene resuelto por el backend (nunca vacio), asi que
  // reflejamos lo que el backend realmente calculo, no el draft local.
  const buLabel = (data?.business_units ?? businessUnits)
    .map((bu) => t(`scrapRate.businessUnits.${bu.toLowerCase()}`))
    .join(", ") || t("scrapRate.allBusinessUnits");

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
        <BUSelect
          value={businessUnits}
          onChange={(bu: string[]) => setBusinessUnits(bu as ScrapRateBusinessUnit[])}
          options={SCRAP_RATE_BU_OPTIONS.map((bu) => ({
            value: bu,
            label: t(`scrapRate.businessUnits.${bu.toLowerCase()}`),
          }))}
        />

        <div style={{ width: 1, alignSelf: "stretch", background: "var(--color-border)" }} />

        <DateRangeSelector
          value={dateRange}
          onChange={setDateRange}
          defaultPreset="last_90_days"
          extraGroups={SCRAP_RATE_EXTRA_PRESET_GROUPS}
        />

        <button style={{ ...toggleStyle(false), marginLeft: "auto" }} onClick={() => setFullscreen(true)}>
          {t("scrapRate.fullscreen")}
        </button>
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
              {t("scrapRate.title")} · {buLabel}
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