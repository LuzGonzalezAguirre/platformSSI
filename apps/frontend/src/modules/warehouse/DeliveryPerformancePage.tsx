import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, CartesianGrid, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import apiClient from "../../services/api.client";

type Aggregate = { scheduled: number; early: number; on_time: number; late: number; percentage: number; unreconciled: number; releases: number };
type Group = Aggregate & { customer?: string; month?: number; week?: number };
type Detail = {
  release_key: string; release_no: string; customer: string; part: string; revision: string; po: string;
  due_date: string; planned_ship_date: string; scheduled: number; early: number; on_time: number; late: number;
  shipped_recorded: number; detail_shipped: number; variance: number; reconciled: boolean;
  performance_pct: number; source_status: string; month: number; week: number;
};
type Report = {
  year: number; methodology: string; caveat: string; overall: Aggregate;
  monthly_by_customer: Group[]; weekly_by_customer: Group[];
  monthly: Group[]; weekly: Group[]; detail: Detail[];
};
const panel: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 16, minWidth: 0 };
const input: React.CSSProperties = { background: "var(--color-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px" };
const tableCell: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--color-border)", textAlign: "left", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const pct = (v: number) => Number.isFinite(v) ? v.toFixed(2) + "%" : "—";
const monthLabel = (month: number, lang: string, year = 2026) => new Intl.DateTimeFormat(lang, { month: "short" }).format(new Date(year, month - 1, 1));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fromISO = (s: string) => new Date(s + "T00:00:00Z");
const offsetDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);
const mondayOf = (d: Date) => offsetDays(d, -((d.getUTCDay() + 6) % 7));
const weekInfo = (d: Date) => {
  const thursday = offsetDays(d, 3 - ((d.getUTCDay() + 6) % 7));
  const start = mondayOf(new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4)));
  return { year: thursday.getUTCFullYear(), week: 1 + Math.round((mondayOf(thursday).getTime() - start.getTime()) / 604800000) };
};
const today = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
};
type DatePreset = "custom" | "today" | "yesterday" | "last7" | "last30" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "thisYear";
function presetRange(preset: DatePreset): [string, string] {
  const end = fromISO(today());
  const shift = (days: number) => isoDate(offsetDays(end, days));
  const firstMonth = isoDate(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)));
  switch (preset) {
    case "today": return [today(), today()];
    case "yesterday": return [shift(-1), shift(-1)];
    case "last7": return [shift(-6), today()];
    case "last30": return [shift(-29), today()];
    case "thisWeek": return [isoDate(mondayOf(end)), today()];
    case "lastWeek": return [isoDate(offsetDays(mondayOf(end), -7)), isoDate(offsetDays(mondayOf(end), -1))];
    case "thisMonth": return [firstMonth, today()];
    case "lastMonth": return [isoDate(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1))), isoDate(offsetDays(fromISO(firstMonth), -1))];
    case "thisYear": return [end.getUTCFullYear() + "-01-01", today()];
    default: return [firstMonth, today()];
  }
}

export default function DeliveryPerformancePage() {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const tx = (esText: string, enText: string) => es ? esText : enText;
  const [preset, setPreset] = useState<DatePreset>("thisMonth");
  const [dateFrom, setDateFrom] = useState(() => presetRange("thisMonth")[0]);
  const [dateTo, setDateTo] = useState(() => presetRange("thisMonth")[1]);
  const [customer, setCustomer] = useState("");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  const validRange = !!dateFrom && !!dateTo && dateFrom <= dateTo;
  const load = async () => {
    if (!validRange) {
      setData(null);
      setError(tx("El rango de fechas es inválido.", "Invalid date range."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Always retrieve the six calendar weeks ending at the reference date.
      const trendFrom = isoDate(offsetDays(mondayOf(fromISO(dateTo)), -35));
      const sixMonthFrom = isoDate(new Date(Date.UTC(Number(dateTo.slice(0, 4)), Number(dateTo.slice(5, 7)) - 6, 1)));
      const minimum = [dateFrom, trendFrom, sixMonthFrom].sort()[0];
      const minYear = Number(minimum.slice(0, 4));
      const maxYear = Number(dateTo.slice(0, 4));
      if (maxYear - minYear > 3) throw new Error(tx("Selecciona un rango de hasta 3 años.", "Select a range up to 3 years."));
      const responses = await Promise.all(Array.from({ length: maxYear - minYear + 1 }, (_, i) =>
        apiClient.get<Report>("/warehouse/delivery-performance/", { params: { year: minYear + i } })));
      setData({ ...responses[responses.length - 1].data, detail: responses.flatMap(response => response.data.detail) });
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : tx("No fue posible consultar Plex.", "Could not retrieve Plex data."));
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [dateFrom, dateTo]);

  const customers = useMemo(() => [...new Set(data?.detail.map(x => x.customer) ?? [])].sort(), [data]);
  const reference = fromISO(dateTo || today());
  const referenceWeek = weekInfo(reference);
  const referenceMonth = reference.getUTCMonth() + 1;
  const referenceYear = reference.getUTCFullYear();
  const view = useMemo(() => {
    if (!data || !validRange) return null;
    const aggregate = (rows: Detail[]): Aggregate => {
      const scheduled = rows.reduce((a, x) => a + x.scheduled, 0);
      const early = rows.reduce((a, x) => a + x.early, 0);
      const on_time = rows.reduce((a, x) => a + x.on_time, 0);
      return {
        scheduled, early, on_time,
        late: rows.reduce((a, x) => a + x.late, 0),
        percentage: rows.length ? Math.round(rows.reduce((sum, x) => sum + x.performance_pct, 0) / rows.length * 100) / 100 : 0,
        unreconciled: rows.filter(x => !x.reconciled).length,
        releases: rows.length,
      };
    };
    const chosen = data.detail.filter(x => !customer || x.customer === customer);
    const within = chosen.filter(x => x.planned_ship_date >= dateFrom && x.planned_ship_date <= dateTo);
    const referenceMonthPrefix = dateTo.slice(0, 7);
    const monday = isoDate(mondayOf(reference));
    const monthRows = within.filter(x => x.planned_ship_date.slice(0, 7) === referenceMonthPrefix);
    const weekRows = within.filter(x => x.planned_ship_date >= monday);
    const byCustomer = (rows: Detail[]) => [...new Set(rows.map(x => x.customer))].sort()
      .map(name => ({ name, ...aggregate(rows.filter(x => x.customer === name)) }));
    const monthly = Array.from({ length: 6 }, (_, index) => {
      const period = new Date(Date.UTC(referenceYear, referenceMonth - 6 + index, 1));
      const ym = isoDate(period).slice(0, 7);
      return {
        name: monthLabel(period.getUTCMonth() + 1, i18n.language, period.getUTCFullYear()) + " " + period.getUTCFullYear(),
        ...aggregate(chosen.filter(x => x.planned_ship_date.slice(0, 7) === ym && x.planned_ship_date <= dateTo)),
      };
    });
    const lastMonday = mondayOf(reference);
    const weeks = Array.from({ length: 6 }, (_, index) => {
      const first = isoDate(offsetDays(lastMonday, (index - 5) * 7));
      const last = isoDate(offsetDays(lastMonday, (index - 5) * 7 + 6));
      const wk = weekInfo(fromISO(first));
      return {
        name: "W" + String(wk.week).padStart(2, "0") + "/" + String(wk.year).slice(2),
        week: wk.week,
        ...aggregate(chosen.filter(x => x.planned_ship_date >= first && x.planned_ship_date <= last && x.planned_ship_date <= dateTo)),
      };
    });
    return { monthlyCustomers: byCustomer(monthRows), weeklyCustomers: byCustomer(weekRows), monthly, weeks, detail: within, totals: aggregate(within) };
  }, [data, dateFrom, dateTo, customer, i18n.language, validRange, referenceYear, referenceMonth]);

  useEffect(() => {
    if (!expandedChart) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setExpandedChart(null); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [expandedChart]);

  const chart = (id: string, title: string, rows: Array<{ name: string; percentage: number; releases?: number }>, description: string, expanded = false) => (
    <section style={{ ...panel, display: "flex", flexDirection: "column", minWidth: 0, height: expanded ? "100%" : 425 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: expanded ? 22 : 16, margin: "0 0 4px" }}>{title}</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>{description}</p>
        </div>
        <button type="button" aria-label={expanded ? tx("Cerrar gráfica", "Close chart") : tx("Expandir gráfica", "Expand chart")}
          onClick={() => setExpandedChart(expanded ? null : id)}
          style={{ ...input, cursor: "pointer", whiteSpace: "nowrap" }}>
          {expanded ? tx("Cerrar ×", "Close ×") : tx("Expandir ⛶", "Expand ⛶")}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ left: -5, right: 20, top: 24, bottom: 28 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.7}/>
            <XAxis dataKey="name" interval={0} angle={rows.length > 8 ? -30 : 0} textAnchor={rows.length > 8 ? "end" : "middle"} height={60} tick={{ fill: "var(--color-text-secondary)", fontSize: expanded ? 13 : 11 }} />
            <YAxis domain={[0, 105]} unit="%" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}/>
            <Tooltip formatter={value => pct(Number(value ?? 0))}/>
            <Legend verticalAlign="top" height={30}/>
            <Bar dataKey="percentage" name="OTD" fill="#5999d3" maxBarSize={expanded ? 80 : 50} radius={[4,4,0,0]} isAnimationActive={false}>
              <LabelList dataKey="percentage" position="top" formatter={value => pct(Number(value ?? 0))} fill="var(--color-text-primary)" fontSize={expanded ? 14 : 11} fontWeight={700}/>
            </Bar>
            <Line type="linear" dataKey={() => 100} name={tx("Meta 100%", "Target 100%")} stroke="#36b77e" strokeWidth={2} dot={false} isAnimationActive={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {rows.length === 0 && <p style={{ color: "var(--color-text-secondary)" }}>{tx("Sin datos en el período.", "No data for this period.")}</p>}
    </section>
  );

  return <div style={{ display: "grid", gap: 14, color: "var(--color-text-primary)" }}>
    <header><h1 style={{ fontSize: 24, margin: 0 }}>Delivery Performance (OTD)</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{tx("Cumplimiento de embarques por cliente, semana y mes — fuente Plex", "Shipment performance by customer, week and month — Plex source")}</p>
    </header>
    <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "end" }}>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Periodo", "Period")}
        <select value={preset} onChange={e => {
          const next = e.target.value as DatePreset;
          setPreset(next);
          if (next !== "custom") {
            const [from, to] = presetRange(next);
            setDateFrom(from);
            setDateTo(to);
          }
        }} style={{ ...input, minWidth: 155 }}>
          {([
            ["custom", tx("Custom", "Custom")],
            ["today", tx("Today", "Today")],
            ["yesterday", tx("Yesterday", "Yesterday")],
            ["last7", tx("Last 7 days", "Last 7 days")],
            ["last30", tx("Last 30 days", "Last 30 days")],
            ["thisWeek", tx("This week", "This week")],
            ["lastWeek", tx("Last week", "Last week")],
            ["thisMonth", tx("This month", "This month")],
            ["lastMonth", tx("Last month", "Last month")],
            ["thisYear", tx("This year", "This year")],
          ] as [DatePreset, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Desde", "From")}
        <input type="date" value={dateFrom} onChange={e => { setPreset("custom"); setDateFrom(e.target.value); }} style={input}/>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Hasta (referencia)", "To (reference)")}
        <input type="date" value={dateTo} onChange={e => { setPreset("custom"); setDateTo(e.target.value); }} style={input}/>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Semana ISO", "ISO week")}
        <span style={{ ...input, display: "inline-flex", alignItems: "center" }}>{referenceWeek.year} - W{String(referenceWeek.week).padStart(2, "0")}</span>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Cliente", "Customer")}
        <select value={customer} onChange={e => setCustomer(e.target.value)} style={{ ...input, maxWidth: 270 }}>
          <option value="">{tx("Todos los clientes", "All customers")}</option>
          {customers.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <button style={input} type="button" onClick={() => void load()} disabled={loading || !validRange}>{loading ? tx("Cargando…", "Loading…") : tx("Actualizar", "Refresh")}</button>
    </div>
    {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}
    {data && view && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {[
          ["Scheduled", view.totals.scheduled.toLocaleString(i18n.language)],
          ["Early Deliveries", view.totals.early.toLocaleString(i18n.language)],
          ["On Time Deliveries", view.totals.on_time.toLocaleString(i18n.language)],
          ["Late Deliveries", view.totals.late.toLocaleString(i18n.language)],
          ["Delivery Performance", pct(view.totals.percentage)],
        ].map(([label, value]) =>
          <div key={label} style={panel}><span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span><div style={{ fontWeight: 750, fontSize: 26, marginTop: 6 }}>{value}</div></div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16, width: "100%", minWidth: 0 }}>
        {chart("monthlyCustomers", tx("OTD mensual por cliente", "Monthly OTD by customer"), view.monthlyCustomers, monthLabel(referenceMonth, i18n.language, referenceYear) + " " + referenceYear)}
        {chart("weeklyCustomers", tx("OTD semanal por cliente", "Weekly OTD by customer"), view.weeklyCustomers, tx("Semana", "Week") + " " + referenceWeek.week + "/" + referenceWeek.year)}
        {chart("weeklyTrend", tx("Tendencia semanal", "Weekly trend"), view.weeks, tx("Últimas 6 semanas desde Hasta", "Last 6 weeks as of To date"))}
        {chart("monthlyTrend", tx("Tendencia mensual", "Monthly trend"), view.monthly, tx("Últimos 6 meses desde Hasta", "Last 6 months as of To date"))}
      </div>
      {expandedChart && <div role="dialog" aria-modal="true" aria-label={tx("Gráfica ampliada", "Expanded chart")}
        style={{ position: "fixed", inset: 0, zIndex: 9999, padding: 20, background: "var(--color-background, #101820)", display: "flex", flexDirection: "column" }}>
        {expandedChart === "monthlyCustomers" && chart("monthlyCustomers", tx("OTD mensual por cliente", "Monthly OTD by customer"), view.monthlyCustomers, monthLabel(referenceMonth, i18n.language, referenceYear) + " " + referenceYear, true)}
        {expandedChart === "weeklyCustomers" && chart("weeklyCustomers", tx("OTD semanal por cliente", "Weekly OTD by customer"), view.weeklyCustomers, tx("Semana", "Week") + " " + referenceWeek.week + "/" + referenceWeek.year, true)}
        {expandedChart === "weeklyTrend" && chart("weeklyTrend", tx("Tendencia semanal", "Weekly trend"), view.weeks, tx("Últimas 6 semanas desde Hasta", "Last 6 weeks as of To date"), true)}
        {expandedChart === "monthlyTrend" && chart("monthlyTrend", tx("Tendencia mensual", "Monthly trend"), view.monthly, tx("Últimos 6 meses desde Hasta", "Last 6 months as of To date"), true)}
      </div>}
      <details style={panel}>
        <summary style={{ fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>{tx("Detalle de liberaciones", "Release detail")} ({view.detail.length})</summary>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["Customer", "Part", "Revision", "PO", "Release", "Due Date", "Ship Date", "Scheduled", "Early", "On Time", "Late", "OTD", tx("Conciliación", "Reconciliation")].map(label => <th key={label} style={tableCell}>{label}</th>)}</tr></thead>
            <tbody>{view.detail.map(x => <tr key={x.release_key}>
              <td style={tableCell}>{x.customer}</td><td style={tableCell}>{x.part}</td><td style={tableCell}>{x.revision}</td>
              <td style={tableCell}>{x.po}</td><td style={tableCell} title={x.release_key}>{x.release_no || "—"}</td>
              <td style={tableCell}>{x.due_date}</td><td style={tableCell}>{x.planned_ship_date}</td>
              <td style={tableCell}>{x.scheduled}</td><td style={tableCell}>{x.early}</td><td style={tableCell}>{x.on_time}</td><td style={tableCell}>{x.late}</td>
              <td style={tableCell}>{pct(x.performance_pct)}</td>
              <td style={{ ...tableCell, color: x.reconciled ? "#16a34a" : "#d97706" }} title={x.reconciled ? "" : tx("Diferencia", "Variance") + ": " + x.variance}>{x.reconciled ? "OK" : tx("Revisar", "Review")}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </>}
  </div>;
}
