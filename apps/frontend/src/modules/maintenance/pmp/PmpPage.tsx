import { useState, useMemo, useEffect } from "react";
import { Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePmpData } from "./usePmpData";
import PmpKpiSection from "./PmpKpiSection";
import PmpCalendar from "./PmpCalendar";
import PmpDetailPanel from "./PmpDetailPanel";
import { DayBucket, PM, buKey, dateKey, eventStatus } from "./types";

const selectStyle: React.CSSProperties = {
  height: 36, padding: "0 0.5rem", fontSize: "0.875rem",
  borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
  background: "var(--color-surface)", color: "var(--color-text-primary)",
  textTransform: "capitalize",
};

export default function PmpPage() {
  const { t, i18n } = useTranslation();
  const now = new Date();

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [fleet, setFleet] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, loading, error } = usePmpData(year, month);

  const todayKey = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  useEffect(() => { setSelected(null); }, [year, month]);

  // Las flotas se derivan de lo que manda el backend, nunca se hardcodean:
  // el valor exacto de BusinessUnit (casing incluido) lo define Django.
  const availableFleets = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>();
    for (const b of data.kpis.by_bu_year) seen.set(buKey(b.bu), b.bu);
    for (const e of data.events)          seen.set(buKey(e.bu), e.bu);
    const order = ["volvo", "cummins", "tulc", "unclassified"];
    return [...seen.entries()]
      .sort((a, b) => {
        const ia = order.indexOf(a[0]); const ib = order.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([, original]) => original);
  }, [data]);

  const monthEvents = useMemo(() => {
    if (!data) return [];
    if (fleet === "all") return data.events;
    return data.events.filter((e) => buKey(e.bu) === buKey(fleet));
  }, [data, fleet]);

  const buckets = useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (const ev of monthEvents) {
      const key = ev.due_date.slice(0, 10);
      const b = map.get(key) ?? {
        key, day: Number(key.slice(8, 10)),
        total: 0, complete: 0, open: 0, hold: 0, cancelled: 0,
      };
      b.total += 1;
      b[eventStatus(ev)] += 1;
      map.set(key, b);
    }
    return map;
  }, [monthEvents]);

  const selectedRequests = useMemo(
    () => (selected ? monthEvents.filter((e) => e.due_date.slice(0, 10) === selected) : []),
    [monthEvents, selected]
  );

  const fleetCounts = useMemo(() => {
    if (!data) return [];
    const acc = new Map<string, { bu: string; count: number }>();
    for (const bu of availableFleets) acc.set(buKey(bu), { bu, count: 0 });
    for (const ev of data.events) {
      const k = buKey(ev.bu);
      const entry = acc.get(k) ?? { bu: ev.bu, count: 0 };
      entry.count += 1;
      acc.set(k, entry);
    }
    return [...acc.values()];
  }, [data, availableFleets]);

  // El % anual se calcula en backend sobre el año completo: el frontend solo
  // recibe los eventos del mes, así que aquí no hay base para derivarlo.
  const yearStats = useMemo(() => {
    if (!data?.kpis.year_stats) return null;
    const key = fleet === "all" ? "all" : buKey(fleet);
    return data.kpis.year_stats[key] ?? null;
  }, [data, fleet]);

  const yearTotal = useMemo(() => {
    if (!data) return 0;
    if (yearStats) return yearStats.total;
    if (fleet === "all") return data.kpis.total_year;
    return data.kpis.by_bu_year.find((b) => buKey(b.bu) === buKey(fleet))?.count ?? 0;
  }, [data, fleet, yearStats]);

  const countBy = (s: string) =>
    monthEvents.filter((e) => eventStatus(e) === s).length;

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  const dateLabel = selected
    ? new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, Number(selected.slice(8, 10)))
        .toLocaleDateString(i18n.language, { weekday: "long", month: "short", day: "2-digit", year: "numeric" })
    : t("pmp.panel.empty");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1.25rem" }}>
      <header style={{
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "var(--radius-sm)", background: PM.accent, color: "#fff",
          }}>
            <Wrench size={18} />
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {t("pmp.title")}
            </h1>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              {t("pmp.subtitle")}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <div style={{
            display: "flex", alignItems: "center", padding: 2, gap: 2,
            borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}>
            {["all", ...availableFleets].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFleet(opt)}
                style={{
                  borderRadius: 4, padding: "0.375rem 0.625rem", fontSize: "0.75rem",
                  fontWeight: 500, cursor: "pointer", border: "none",
                  background: fleet === opt ? "var(--color-bg)" : "transparent",
                  color: fleet === opt ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                }}
              >
                {opt === "all" ? t("pmp.fleets.all") : t(`pmp.bu.${buKey(opt)}`, { defaultValue: opt })}
              </button>
            ))}
          </div>

          <select aria-label={t("pmp.selectMonth")} value={month}
            onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(year, m - 1, 1).toLocaleDateString(i18n.language, { month: "long" })}
              </option>
            ))}
          </select>

          <select aria-label={t("pmp.selectYear")} value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ ...selectStyle, fontFamily: PM.mono, textTransform: "none" }}>
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </header>

      {error && (
        <div style={{
          padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)",
          border: "1px solid #ef4444", borderRadius: "var(--radius-md)",
          color: "#ef4444", fontSize: "0.875rem",
        }}>
          {t("pmp.loadError")}
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
          {t("pmp.loading")}
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
          <PmpKpiSection
            monthTotal={monthEvents.length}
            yearTotal={yearTotal}
            year={year}
            complete={countBy("complete")}
            open={countBy("open")}
            hold={countBy("hold")}
            cancelled={countBy("cancelled")}
            fleets={fleetCounts}
            yearStats={yearStats}
          />

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr) 22rem", alignItems: "start" }}>
            <PmpCalendar
              year={year}
              month={month}
              buckets={buckets}
              selected={selected}
              today={todayKey}
              onSelect={setSelected}
              onPrev={() => shiftMonth(-1)}
              onNext={() => shiftMonth(1)}
              onToday={() => {
                setYear(now.getFullYear());
                setMonth(now.getMonth() + 1);
                setSelected(todayKey);
              }}
            />
            <PmpDetailPanel dateLabel={dateLabel} requests={selectedRequests} />
          </div>
        </div>
      )}
    </div>
  );
}