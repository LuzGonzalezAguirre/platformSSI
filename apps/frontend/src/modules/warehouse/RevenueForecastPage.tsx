import { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/api.client";

type Row = {
  Release_Key: number; Customer_No: number; PO_No: string;
  Part_No_Rev: string; Release_Type: string; Ship_Date: string;
  Rel_Qty: number; Rel_Bal: number; Shipped: number;
  Unit_Price: number | null; Forecast_Revenue: number | null;
  Remaining_Revenue: number | null; Price_Key: number | null;
  Price_Issue: string | null;
};
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const qty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const iso = (date: Date) => date.toISOString().slice(0, 10);

type Group = { key: string; qty: number; revenue: number; missing: number; rows: number };
function group(rows: Row[], selector: (r: Row) => string): Group[] {
  const index = new Map<string, Group>();
  rows.forEach(r => {
    const key = selector(r);
    const item = index.get(key) ?? { key, qty: 0, revenue: 0, missing: 0, rows: 0 };
    item.qty += r.Rel_Qty;
    item.revenue += r.Forecast_Revenue ?? 0;
    item.missing += r.Forecast_Revenue === null ? 1 : 0;
    item.rows += 1;
    index.set(key, item);
  });
  return Array.from(index.values()).sort((a, b) => a.key.localeCompare(b.key));
}
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", padding: 10, borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: 10, borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" };
const panel: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 18, marginTop: 18, overflowX: "auto" };
function SummaryTable({ title, groups }: { title: string; groups: Group[] }) {
  return <section style={panel}><h3>{title}</h3><table style={tableStyle}><thead><tr>
    <th style={th}>Group</th><th style={th}>Releases</th><th style={th}>Rel Qty</th>
    <th style={th}>Forecast Revenue</th><th style={th}>Sin precio</th>
  </tr></thead><tbody>{groups.map(g => <tr key={g.key}>
    <td style={td}>{g.key}</td><td style={td}>{g.rows}</td><td style={td}>{qty(g.qty)}</td>
    <td style={td}>{money(g.revenue)}{g.missing ? " (parcial)" : ""}</td><td style={td}>{g.missing}</td>
  </tr>)}</tbody></table></section>;
}
export default function RevenueForecastPage() {
  const today = new Date();
  const [startDate, setStartDate] = useState(() => iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => iso(today));
  const [status, setStatus] = useState("All");
  const [customer, setCustomer] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setError("Invalid date range"); return;
    }
    setLoading(true); setError("");
    try {
      const res = await apiClient.get<Row[]>("/warehouse/revenue-forecast/", {
        params: { start_date: startDate, end_date: endDate, status,
          ...(customer ? { customer_no: Number(customer) } : {}) },
      });
      setRows(res.data);
    } catch (e) { setRows([]); setError("Could not load Plex revenue forecast"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const byType = useMemo(() => group(rows, r => r.Release_Type), [rows]);
  const byCustomer = useMemo(() => group(rows, r => r.Release_Type + " / " + r.Customer_No), [rows]);
  const byPart = useMemo(() => group(rows, r => r.Release_Type + " / " + r.Customer_No + " / " + r.Part_No_Rev), [rows]);
  const daily = useMemo(() => {
    const items = group(rows, r => r.Ship_Date);
    let accumulated = 0;
    return items.map(item => ({ ...item, accumulated: (accumulated += item.revenue) }));
  }, [rows]);
  const total = rows.reduce((v, r) => v + (r.Forecast_Revenue ?? 0), 0);
  const remaining = rows.reduce((v, r) => v + (r.Remaining_Revenue ?? 0), 0);
  const missing = rows.filter(r => r.Forecast_Revenue === null).length;
  return <main style={{ padding: 24, color: "var(--color-text-primary)" }}>
    <h2>Revenue Forecast</h2>
    <p style={{ color: "var(--color-text-secondary)" }}>Proyección por releases de Demand y precios de venta por PO en Plex. Valores sin precio verificable no se estiman.</p>
    <div style={{ ...panel, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
      <label>From<br/><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/></label>
      <label>To<br/><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/></label>
      <label>Status<br/><select value={status} onChange={e => setStatus(e.target.value)}><option>All</option><option>Open</option><option>History</option></select></label>
      <label>Customer No<br/><input type="number" placeholder="All" value={customer} onChange={e => setCustomer(e.target.value)}/></label>
      <button disabled={loading} onClick={() => void load()}>{loading ? "Loading..." : "Refresh"}</button>
    </div>
    {error && <p role="alert" style={{ color: "var(--color-stopped)" }}>{error}</p>}
    <div style={{ ...panel, display: "flex", gap: 30, flexWrap: "wrap" }}>
      <span><strong>Releases</strong><br/>{rows.length}</span>
      <span><strong>Forecast Revenue (priced)</strong><br/>{money(total)}</span>
      <span><strong>Remaining Revenue (priced)</strong><br/>{money(remaining)}</span>
      <span><strong>Missing/unverified prices</strong><br/>{missing}</span>
    </div>
    <SummaryTable title="Revenue by Release Type" groups={byType}/>
    <SummaryTable title="Revenue by Customer" groups={byCustomer}/>
    <SummaryTable title="Revenue by Part" groups={byPart}/>
    <section style={panel}><h3>Revenue by Ship Date</h3><table style={tableStyle}><thead><tr><th style={th}>Ship Date</th><th style={th}>Release Qty</th><th style={th}>Daily Revenue</th><th style={th}>Accumulated</th><th style={th}>Unpriced</th></tr></thead><tbody>{daily.map(d => <tr key={d.key}><td style={td}>{d.key}</td><td style={td}>{qty(d.qty)}</td><td style={td}>{money(d.revenue)}</td><td style={td}>{money(d.accumulated)}</td><td style={td}>{d.missing}</td></tr>)}</tbody></table></section>
    <section style={panel}><h3>Release detail / price audit</h3><table style={tableStyle}><thead><tr>{["Release","PO","Customer","Part","Type","Ship Date","Rel Qty","Balance","Unit Price","Forecast","Price Key"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.Release_Key}><td style={td}>{r.Release_Key}</td><td style={td}>{r.PO_No}</td><td style={td}>{r.Customer_No}</td><td style={td}>{r.Part_No_Rev}</td><td style={td}>{r.Release_Type}</td><td style={td}>{r.Ship_Date}</td><td style={td}>{qty(r.Rel_Qty)}</td><td style={td}>{qty(r.Rel_Bal)}</td><td style={td}>{r.Unit_Price === null ? "N/A" : money(r.Unit_Price)}</td><td style={td} title={r.Price_Issue ?? ""}>{r.Forecast_Revenue === null ? "N/A" : money(r.Forecast_Revenue)}</td><td style={td}>{r.Price_Key ?? "—"}</td></tr>)}</tbody></table></section>
  </main>;
}
