import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
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
const monthLabel = (month: number, lang: string) => new Intl.DateTimeFormat(lang, { month: "short" }).format(new Date(2026, month - 1, 1));

export default function DeliveryPerformancePage() {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const tx = (esText: string, enText: string) => es ? esText : enText;
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10);
  const [week, setWeek] = useState(41);
  const [customer, setCustomer] = useState("");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.get<Report>("/warehouse/delivery-performance/", { params: { year } });
      setData(result.data);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : tx("No fue posible consultar Plex.", "Could not retrieve Plex data."));
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [year]);

  const customers = useMemo(() => [...new Set(data?.detail.map(x => x.customer) ?? [])].sort(), [data]);
  const view = useMemo(() => {
    if (!data) return null;
    const aggregate = (rows: Detail[]): Aggregate => {
      const scheduled = rows.reduce((a, x) => a + x.scheduled, 0);
      const early = rows.reduce((a, x) => a + x.early, 0);
      const on_time = rows.reduce((a, x) => a + x.on_time, 0);
      return {
        scheduled, early, on_time,
        late: rows.reduce((a, x) => a + x.late, 0),
        percentage: rows.length ? Math.round(rows.reduce((sum, x) => sum + x.performance_pct, 0) / rows.length * 100) / 100 : 0,
        unreconciled: rows.filter(x => !x.reconciled).length, releases: rows.length,
      };
    };
    const chosen = data.detail.filter(x => !customer || x.customer === customer);
    const monthRows = chosen.filter(x => x.month === month);
    const weekRows = chosen.filter(x => x.week === week);
    const monthlyCustomers = [...new Set(monthRows.map(x => x.customer))].sort().map(name => ({ name, ...aggregate(monthRows.filter(x => x.customer === name)) }));
    const weeklyCustomers = [...new Set(weekRows.map(x => x.customer))].sort().map(name => ({ name, ...aggregate(weekRows.filter(x => x.customer === name)) }));
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return { name: monthLabel(m, i18n.language), month: m, ...aggregate(chosen.filter(x => x.month === m)) };
    });
    const weeks = [...new Set(chosen.map(x => x.week))].sort((a,b) => a - b).map(w => ({ name: String(w), week: w, ...aggregate(chosen.filter(x => x.week === w)) }));
    return { monthlyCustomers, weeklyCustomers, monthly, weeks, detail: monthRows, totals: aggregate(monthRows) };
  }, [data, month, week, customer, i18n.language]);

  const chart = (title: string, rows: Array<{ name: string; percentage: number }>, type: "bar" | "mixed", description: string) => (
    <section style={panel}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>{title}</h2>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>{description}</p>
      <div style={{ height: 300, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ left: -14, right: 12, top: 6, bottom: 32 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.7}/>
            <XAxis dataKey="name" interval={0} angle={rows.length > 7 ? -35 : 0} textAnchor={rows.length > 7 ? "end" : "middle"} height={54} tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}/>
            <Tooltip formatter={value => pct(Number(value ?? 0))}/>
            <Legend verticalAlign="top" height={28}/>
            <Bar dataKey="percentage" name="OTD" fill="#5999d3" maxBarSize={42} radius={[4,4,0,0]} isAnimationActive={false}/>
            <Line type="linear" dataKey={() => 100} name={tx("Meta 100%", "Target 100%")} stroke="#36b77e" strokeWidth={2} dot={false} isAnimationActive={false}/>
            {type === "mixed" ? null : null}
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
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Año", "Year")}
        <input type="number" min={2020} max={new Date().getFullYear() + 1} value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...input, width: 110 }}/>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Mes", "Month")}
        <select value={month} onChange={e => setMonth(Number(e.target.value))} style={input}>
          {Array.from({ length: 12 }, (_, i) => i+1).map(m => <option key={m} value={m}>{monthLabel(m, i18n.language)}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Semana ISO", "ISO week")}
        <select value={week} onChange={e => setWeek(Number(e.target.value))} style={input}>
          {Array.from({ length: 53 }, (_, i) => i+1).map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>{tx("Cliente", "Customer")}
        <select value={customer} onChange={e => setCustomer(e.target.value)} style={{ ...input, maxWidth: 270 }}>
          <option value="">{tx("Todos los clientes", "All customers")}</option>
          {customers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <button style={input} type="button" onClick={() => void load()} disabled={loading}>{loading ? tx("Cargando…", "Loading…") : tx("Actualizar", "Refresh")}</button>
    </div>
    {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}
    {data && view && <>
      <div style={{ ...panel, borderLeft: "4px solid #d97706", fontSize: 12 }}>
        <strong>{tx("Cálculo provisional — pendiente de validación final contra Plex.", "Provisional calculation — pending final Plex validation.")}</strong>
        {" "}{tx("El OTD es el promedio por liberación (To Promise / Volume). La conciliación EDI y el ajuste horario continúan en validación.", "OTD is the mean of release percentages (To Promise / Volume). EDI reconciliation and timezone normalization remain under validation.")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {[ [tx("OTD del mes", "Monthly OTD"), pct(view.totals.percentage)],
           [tx("Programado", "Scheduled"), view.totals.scheduled.toLocaleString(i18n.language)],
           [tx("Early + On Time", "Early + On Time"), (view.totals.early + view.totals.on_time).toLocaleString(i18n.language)],
           [tx("Sin conciliar", "Unreconciled"), String(view.totals.unreconciled)] ].map(([label, value]) =>
          <div key={label} style={panel}><span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span><div style={{ fontWeight: 750, fontSize: 26, marginTop: 6 }}>{value}</div></div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,450px),1fr))", gap: 12 }}>
        {chart(tx("OTD mensual por cliente", "Monthly OTD by customer"), view.monthlyCustomers, "bar", monthLabel(month, i18n.language) + " " + year)}
        {chart(tx("OTD semanal por cliente", "Weekly OTD by customer"), view.weeklyCustomers, "bar", tx("Semana", "Week") + " " + week)}
        {chart(tx("Tendencia semanal", "Weekly trend"), view.weeks, "mixed", tx("Todas las semanas disponibles", "All available weeks"))}
        {chart(tx("Tendencia mensual", "Monthly trend"), view.monthly, "mixed", String(year))}
      </div>
      <section style={panel}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>{tx("Detalle de liberaciones", "Release detail")} ({view.detail.length})</h2>
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
      </section>
    </>}
  </div>;
}
