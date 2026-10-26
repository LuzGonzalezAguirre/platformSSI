import "./warehouse-unified.css";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/api.client";

type Release = {
  Release_Key: number;
  PO_No: string;
  Customer_No: number;
  Part_No_Rev: string;
  Release_Type: string;
  Ship_Date: string;
  Rel_Qty: number;
  Rel_Bal: number;
  Unit_Price: number | null;
  Forecast_Revenue: number | null;
  Price_Issue: string | null;
};
type ActualRevenue = { Account_No: string; Revenue: number };
type DailyRow = {
  date: string;
  quantity: number;
  revenue: number;
  cumulative: number;
  forecast: number;
  achievement: number;
  targetPercent: number;
  missing: number;
  releases: number;
};
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const localISO = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");
const panel: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)", padding: "1.15rem 1.4rem", overflowX: "auto", minWidth: 0,
};
const th: React.CSSProperties = {
  padding: "0.65rem", background: "var(--color-bg)", color: "var(--color-text-secondary)",
  borderBottom: "2px solid var(--color-border)", textAlign: "left", whiteSpace: "nowrap",
  fontWeight: 700, fontSize: 12,
};
const td: React.CSSProperties = {
  padding: "0.55rem 0.65rem", borderBottom: "1px solid var(--color-border)",
  color: "var(--color-text-primary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
};
function datesBetween(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const cursor = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  const dates: string[] = [];
  while (cursor <= last && dates.length <= 180) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
function isWorkday(date: string): boolean {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  return day >= 1 && day <= 5;
}

export default function RevenueForecastPage() {
  const [startDate, setStartDate] = useState(() => localISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => localISO(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [customer, setCustomer] = useState("");
  const [rows, setRows] = useState<Release[]>([]);
  const [actual, setActual] = useState<ActualRevenue[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedRange, setLoadedRange] = useState("");
  const [error, setError] = useState("");
  const goalKey = `warehouse-revenue-goal:${startDate.slice(0, 7)}`;
  const [goalInput, setGoalInput] = useState(() => {
    try { return window.localStorage.getItem(`warehouse-revenue-goal:${localISO(new Date()).slice(0, 7)}`) ?? ""; }
    catch { return ""; }
  });
  useEffect(() => {
    try { setGoalInput(window.localStorage.getItem(goalKey) ?? ""); }
    catch { setGoalInput(""); }
  }, [goalKey]);
  const updateGoal = (value: string) => {
    setGoalInput(value);
    try {
      if (value.trim()) window.localStorage.setItem(goalKey, value);
      else window.localStorage.removeItem(goalKey);
    } catch { /* Local storage can be unavailable. */ }
  };
  const goal = Number(goalInput);
  const hasGoal = goalInput.trim() !== "" && Number.isFinite(goal) && goal > 0;
  const load = async () => {
    if (!startDate || !endDate || startDate > endDate || datesBetween(startDate, endDate).length > 180) {
      setError("Selecciona un rango válido de hasta 180 días."); return;
    }
    setLoading(true); setError("");
    try {
      const params = {
        start_date: startDate, end_date: endDate,
        ...(customer ? { customer_no: Number(customer) } : {}),
      };
      const [releases, shipping] = await Promise.all([
        apiClient.get<Release[]>("/warehouse/revenue-forecast/", { params: { ...params, status: "Active" } }),
        apiClient.get<ActualRevenue[]>("/warehouse/shipping-revenue-summary/", { params }),
      ]);
      setRows(releases.data);
      setActual(shipping.data);
      setLoadedRange(`${startDate} → ${endDate}`);
    } catch {
      setError("No se pudieron cargar los releases o el Revenue real desde Plex.");
      setLoadedRange(""); setRows([]); setActual([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const daily = useMemo<DailyRow[]>(() => {
    const dates = datesBetween(startDate, endDate);
    const map = new Map<string, { quantity: number; revenue: number; missing: number; releases: number }>();
    rows.forEach(r => {
      const item = map.get(r.Ship_Date) ?? { quantity: 0, revenue: 0, missing: 0, releases: 0 };
      item.quantity += Number(r.Rel_Qty || 0);
      item.revenue += Number(r.Forecast_Revenue || 0);
      item.missing += r.Forecast_Revenue === null ? 1 : 0;
      item.releases++;
      map.set(r.Ship_Date, item);
    });
    const workdays = dates.filter(isWorkday).length;
    let elapsed = 0;
    let cumulative = 0;
    return dates.map(date => {
      if (isWorkday(date)) elapsed++;
      const day = map.get(date);
      cumulative += day?.revenue ?? 0;
      const targetPercent = workdays ? elapsed / workdays * 100 : 0;
      return {
        date,
        quantity: day?.quantity ?? 0,
        revenue: day?.revenue ?? 0,
        cumulative,
        forecast: hasGoal ? goal * targetPercent / 100 : 0,
        achievement: hasGoal ? cumulative / goal * 100 : 0,
        targetPercent,
        missing: day?.missing ?? 0,
        releases: day?.releases ?? 0,
      };
    });
  }, [rows, startDate, endDate, hasGoal, goal]);
  const totalScheduled = rows.reduce((sum, r) => sum + Number(r.Forecast_Revenue || 0), 0);
  const actualTotal = actual.reduce((sum, r) => sum + Number(r.Revenue || 0), 0);
  const missingPrices = rows.filter(r => r.Forecast_Revenue === null).length;

  return <main className="warehouse-unified" style={{ padding: "0 1rem 2rem" }}>
    <div className="warehouse-heading">
      <span className="warehouse-heading-icon"><TrendingUp size={23}/></span>
      <div><h1>Revenue Forecast</h1><p>Releases programados, avance contra meta mensual y Actual Shipping Revenue.</p></div>
    </div>
    <section className="warehouse-forecast-filter" style={panel}>
      <label>From<br/><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/></label>
      <label>To<br/><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/></label>
      <label>Customer No<br/><input type="number" placeholder="All" value={customer} onChange={e => setCustomer(e.target.value)}/></label>
      <label>Monthly Sales Goal (USD)<br/>
        <input type="number" min="0.01" step="0.01" placeholder="Capturar meta" value={goalInput}
          onChange={e => updateGoal(e.target.value)}/>
      </label>
      <button disabled={loading} onClick={() => void load()}>{loading ? "Loading..." : "Refresh"}</button>
    </section>
    {error && <p className="warehouse-error" role="alert">{error}</p>}
    <p className="warehouse-muted">Período cargado: {loadedRange || "sin datos"} · Meta guardada por mes en este navegador. Se consideran días laborales de lunes a viernes sin descontar feriados.</p>

    <section className="warehouse-forecast-section" style={panel}>
      <h3>Daily Revenue &amp; Sales Goal</h3>
      <p className="warehouse-muted">La cantidad y el Revenue diario se calculan a partir de releases programados (Ship Date), no de facturas reales. La meta y su avance se distribuyen por días laborales. Los fines de semana conservan el acumulado anterior.</p>
      <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
        <thead><tr>
          {["Ship Date","Day","Qty","Revenue (releases)","Workday","Month to Date","Forecast (goal)","% Sales Achievement","% Sales Goal"].map(h => <th style={th} key={h}>{h}</th>)}
        </tr></thead>
        <tbody>
          {daily.map((d, index) => <tr key={d.date}>
            <td style={td}>{d.date}</td>
            <td style={td}>{new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", {weekday:"short",timeZone:"UTC"})}</td>
            <td style={{...td,textAlign:"right"}}>{qty(d.quantity)}</td>
            <td style={{...td,textAlign:"right"}} title={d.missing ? `${d.missing} releases sin precio verificable` : ""}>{money(d.revenue)}{d.missing ? " *" : ""}</td>
            <td style={{...td,textAlign:"right"}}>{isWorkday(d.date) ? daily.slice(0, index + 1).filter(x => isWorkday(x.date)).length : "—"}</td>
            <td style={{...td,textAlign:"right"}}>{money(d.cumulative)}</td>
            <td style={{...td,textAlign:"right"}}>{hasGoal ? money(d.forecast) : "—"}</td>
            <td style={{...td,textAlign:"right",color:hasGoal ? (d.achievement >= d.targetPercent ? "#16a34a" : "#dc2626") : "var(--color-text-primary)",fontWeight:700}}>
              {hasGoal ? d.achievement.toFixed(2) + "%" : "—"}
            </td>
            <td style={{...td,textAlign:"right"}}>{hasGoal ? d.targetPercent.toFixed(2) + "%" : "—"}</td>
          </tr>)}
          <tr style={{background:"var(--color-bg)",fontWeight:700}}>
            <td style={td} colSpan={2}>Total</td><td style={{...td,textAlign:"right"}}>{qty(daily.reduce((sum,d)=>sum+d.quantity,0))}</td>
            <td style={{...td,textAlign:"right"}}>{money(daily.reduce((sum,d)=>sum+d.revenue,0))}</td>
            <td style={td}></td><td style={{...td,textAlign:"right"}}>{money(daily.at(-1)?.cumulative ?? 0)}</td>
            <td style={{...td,textAlign:"right"}}>{hasGoal ? money(goal) : "—"}</td>
            <td style={{...td,textAlign:"right"}}>{hasGoal ? (totalScheduled / goal * 100).toFixed(2) + "%" : "—"}</td>
            <td style={{...td,textAlign:"right"}}>{hasGoal ? "100.00%" : "—"}</td>
          </tr>
        </tbody>
      </table>
      {missingPrices > 0 && <p className="warehouse-muted">* {missingPrices} releases sin precio verificable; las sumas programadas son parciales.</p>}
    </section>

    <section className="warehouse-forecast-section" style={panel}>
      <h3>Releases ({rows.length})</h3>
      <p className="warehouse-muted">Detalle de releases activos recuperados de Plex. El Revenue es estimado según los precios verificables del release.</p>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>{["Release","PO","Customer","Part","Type","Ship Date","Rel Qty","Balance","Unit Price","Forecast Revenue"].map(h=><th style={th} key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(r=><tr key={r.Release_Key}>
          <td style={td}>{r.Release_Key}</td><td style={td}>{r.PO_No}</td>
          <td style={td}>{r.Customer_No}</td><td style={td}>{r.Part_No_Rev}</td>
          <td style={td}>{r.Release_Type}</td><td style={td}>{r.Ship_Date}</td>
          <td style={td}>{qty(r.Rel_Qty)}</td><td style={td}>{qty(r.Rel_Bal)}</td>
          <td style={td}>{r.Unit_Price === null ? "N/A" : money(r.Unit_Price)}</td>
          <td style={td} title={r.Price_Issue ?? ""}>{r.Forecast_Revenue === null ? "N/A" : money(r.Forecast_Revenue)}</td>
        </tr>)}</tbody>
      </table>
    </section>

    <section className="warehouse-forecast-section" style={panel}>
      <h3>Actual Shipping Revenue (Invoice Date)</h3>
      <p className="warehouse-muted">Revenue facturado real por cuenta contable (41000-420 y 41000-470), filtrado por Invoice Date. No se suma al Revenue programado de la tabla diaria.</p>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr><th style={th}>Account No</th><th style={th}>Actual Revenue</th></tr></thead>
        <tbody>
          {actual.map(a=><tr key={a.Account_No}><td style={td}>{a.Account_No}</td><td style={td}>{money(Number(a.Revenue || 0))}</td></tr>)}
          <tr><td style={td}><strong>Total Actual</strong></td><td style={td}><strong>{money(actualTotal)}</strong></td></tr>
        </tbody>
      </table>
    </section>
  </main>;
}
