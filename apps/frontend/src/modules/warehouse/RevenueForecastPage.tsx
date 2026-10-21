import "./warehouse-unified.css";
import { TrendingUp } from "lucide-react";
import RevenueKpiAudit, { type RevenueKpi } from "./RevenueKpiAudit";
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/api.client";

type PriceCandidate = { Price_Key: number; Price: number | null; Active: number; Effective_Date: string | null; Expiration_Date: string | null; Breakpoint_Quantity: number; Unit: string; Currency_Key: number; Selection_Status: string; Exclusion_Reasons: string[] };
type DebugInfo = { Field_Sources: Record<string,string>; Price_Conversion_Raw: number | null; Currency_Key: number | null; Price_Unit: string | null; Candidate_Count: number; Eligible_Count: number; Candidates: PriceCandidate[]; Selection_Rule: string };
type Row = { PO_Line_Key: number; Debug?: DebugInfo;
  EDI_Audit?: { Status: string; Historically_Outdated: boolean; Last_Outdated_Change_Key: number | null; Last_Outdated_Change_Date: string | null; Last_Outdated_EDI_Key: string | null; Change_Events: number; Events_After_Outdated: number; Adjustment_Reason: string; Provisional_Exclusion: boolean; Confirmed_Current: boolean };
  EDI_Provisional_Adjustment?: number | null;
  Adjusted_Forecast_Provisional?: number | null;
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
const th: React.CSSProperties = { textAlign: "left", padding: "0.7rem 1rem", background: "var(--color-bg)", color: "var(--color-text-secondary)", fontWeight: 700, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "0.65rem 1rem", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap", color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" };
const panel: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.15rem 1.4rem", overflowX: "auto", minWidth: 0 };
function SummaryTable({ title, groups }: { title: string; groups: Group[] }) {
  return <section className="warehouse-forecast-section" style={panel}><h3>{title}</h3><table style={tableStyle}><thead><tr>
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
  const [actual, setActual] = useState<{Account_No: string; Revenue: number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<number | null>(null);
  const [auditMetric, setAuditMetric] = useState<RevenueKpi | null>(null);
  const load = async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setError("Invalid date range"); return;
    }
    setLoading(true); setError("");
    try {
      const res = await apiClient.get<Row[]>("/warehouse/revenue-forecast/", {
        params: { start_date: startDate, end_date: endDate, status, debug,
          ...(customer ? { customer_no: Number(customer) } : {}) },
      });
      setRows(res.data);
      setSelectedRelease(null);
      setAuditMetric(null);
      const actualRes = await apiClient.get<{Account_No: string; Revenue: number}[]>("/warehouse/shipping-revenue-summary/", { params: { start_date: startDate, end_date: endDate, ...(customer ? { customer_no: Number(customer) } : {}) } });
      setActual(actualRes.data);
    } catch (e) { setRows([]); setActual([]); setError("Could not load Plex revenue forecast / shipping revenue"); }
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
  const ediAvailable = debug && rows.length > 0 && rows.every(r => Boolean(r.EDI_Audit));
  const historicalOutdated = rows.filter(r => r.EDI_Audit?.Historically_Outdated);
  const laterEvents = historicalOutdated.filter(r => (r.EDI_Audit?.Events_After_Outdated ?? 0) > 0);
  const ediUnpriced = historicalOutdated.filter(r => r.Forecast_Revenue === null);
  const ediAdjustment = historicalOutdated.reduce((sum, r) => sum + (r.Forecast_Revenue ?? 0), 0);
  const ediAdjusted = total - ediAdjustment;
  const ediPendingReview = rows.filter(r => !r.EDI_Audit || !r.EDI_Audit.Confirmed_Current).length;
  const actualTotal = actual.reduce((v, r) => v + Number(r.Revenue || 0), 0);
  const selectedRow = rows.find(r => r.Release_Key === selectedRelease);
  return <main className="warehouse-unified" style={{ padding: "0 1rem 2rem" }}>
    <div className="warehouse-heading"><span className="warehouse-heading-icon"><TrendingUp size={23}/></span><div><h1>Revenue Forecast</h1><p>Proyección por releases de Demand y precios de venta por PO en Plex. Precios no verificados permanecen sin estimar.</p></div></div>
    <div className="warehouse-forecast-filter" style={panel}>
      <label>From<br/><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/></label>
      <label>To<br/><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/></label>
      <label>Status<br/><select value={status} onChange={e => setStatus(e.target.value)}><option>All</option><option>Open</option><option>History</option></select></label>
      <label>Customer No<br/><input type="number" placeholder="All" value={customer} onChange={e => setCustomer(e.target.value)}/></label>
      <label><input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} /> Modo diagnóstico</label>
      <button disabled={loading} onClick={() => void load()}>{loading ? "Loading..." : "Refresh"}</button>
    </div>
    {error && <p role="alert" className="warehouse-error">{error}</p>}
    <div className="warehouse-metric-grid">
      {([
        ["releases", "Releases", rows.length.toLocaleString("en-US")],
        ["forecast", "Forecast Revenue", money(total)],
        ["remaining", "Remaining Revenue", money(remaining)],
        ["missing", "Sin precio verificable", missing.toLocaleString("en-US")],
      ] as [RevenueKpi, string, string][]).map(([key, label, value]) =>
        <button key={key} type="button" className="warehouse-metric"
          aria-pressed={auditMetric === key}
          onClick={() => { setAuditMetric(auditMetric === key ? null : key); setSelectedRelease(null); }}
          style={{ cursor: "pointer", textAlign: "left", color: "var(--color-text-primary)",
            borderColor: auditMetric === key ? "var(--color-primary)" : "var(--color-border)" }}>
          <span>{label}</span><strong>{value}</strong>
          <small style={{ color: "var(--color-primary)" }}>Ver origen y desglose →</small>
        </button>)}
    </div>
    {debug && <section className="warehouse-forecast-section" style={panel}>
      <h3>EDI Revenue Adjustment — simulación, no KPI oficial</h3>
      {!ediAvailable ? <p className="warehouse-muted">La auditoría EDI no está disponible en la respuesta actual. Actualiza y reinicia plex-proxy; después pulsa Refresh. No se calcula un ajuste a partir de datos incompletos.</p> :
      <>
        <div className="warehouse-metric-grid">
          <div className="warehouse-metric"><span>Gross Forecast</span><strong>{money(total)}</strong></div>
          <div className="warehouse-metric"><span>Historial EDI obsoleto (importe)</span><strong>{money(ediAdjustment)}</strong></div>
          <div className="warehouse-metric"><span>Adjusted Forecast provisional</span><strong>{money(ediAdjusted)}</strong></div>
          <div className="warehouse-metric"><span>Releases con evento EDI outdated</span><strong>{historicalOutdated.length}</strong></div>
          <div className="warehouse-metric"><span>Con eventos posteriores</span><strong>{laterEvents.length}</strong></div>
          <div className="warehouse-metric"><span>Sin vigencia confirmada</span><strong>{ediPendingReview}</strong></div>
        </div>
        <p className="warehouse-muted">Simulación = Gross Forecast menos el importe de releases con evidencia histórica de desactualización EDI. Un mensaje histórico no confirma que el release siga obsoleto. No se descuentan registros sin precio del monto; {ediUnpriced.length} releases marcados no tienen precio verificable. La clasificación NO confirma la vigencia de ningún release.</p>
        <div style={{maxHeight:440,overflow:"auto"}}>
        <table style={tableStyle}><thead><tr>{["Release_Key","PO","Part","Ship Date","EDI classification","EDI key","Last outdated","Events later","Reason","Gross","Adjustment provisional"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.filter(r=>r.EDI_Audit?.Historically_Outdated).map(r=><tr key={r.Release_Key}>
          <td style={td}>{r.Release_Key}</td><td style={td}>{r.PO_No}</td><td style={td}>{r.Part_No_Rev}</td><td style={td}>{r.Ship_Date}</td>
          <td style={td}>{r.EDI_Audit?.Status ?? "N/A"}</td><td style={td}>{r.EDI_Audit?.Last_Outdated_EDI_Key ?? "—"}</td>
          <td style={td}>{r.EDI_Audit?.Last_Outdated_Change_Date ?? "—"}</td><td style={td}>{r.EDI_Audit?.Events_After_Outdated ?? 0}</td>
          <td style={td}>{r.EDI_Audit?.Adjustment_Reason}</td><td style={td}>{r.Forecast_Revenue === null ? "N/A" : money(r.Forecast_Revenue)}</td>
          <td style={td}>{r.EDI_Provisional_Adjustment === null ? "N/A" : money(r.EDI_Provisional_Adjustment ?? 0)}</td>
        </tr>)}</tbody></table></div>
      </>}
    </section>}
    {debug && auditMetric && <RevenueKpiAudit rows={rows} metric={auditMetric}
      onClose={() => setAuditMetric(null)}
      onInspect={key => setSelectedRelease(key)} />}
    {auditMetric && !debug && <div style={panel}>Activa <strong>Modo diagnóstico</strong> y pulsa <strong>Refresh</strong> para inspeccionar el desglose del KPI.</div>}
    <section className="warehouse-forecast-section" style={panel}><h3>Actual Shipping Revenue (Invoice Date)</h3>
      <p>Accounts 41000-420 and 41000-470. Actual invoice revenue is shown separately; it is not added to forecast.</p>
      <table style={tableStyle}><thead><tr><th style={th}>Account No</th><th style={th}>Actual Revenue</th></tr></thead><tbody>
      {actual.map(a => <tr key={a.Account_No}><td style={td}>{a.Account_No}</td><td style={td}>{money(Number(a.Revenue || 0))}</td></tr>)}
      <tr><td style={td}><strong>Total Actual</strong></td><td style={td}><strong>{money(actualTotal)}</strong></td></tr>
      </tbody></table>
      <p style={{ color: "var(--color-text-secondary)" }}>Forecast by Ship Date and actual by Invoice Date are different measures; direct variance is not a reconciled like-for-like comparison.</p>
    </section>
    {debug && <section className="warehouse-forecast-section" style={panel}><h3>Fórmulas y fuentes</h3><p>Rel Qty = Sales_v_Release.Quantity; Rel Bal = Quantity - Quantity_Shipped; Unit Price = Sales_v_Price.Price por PO_Line_Key; Forecast = Rel Qty × Unit Price; Remaining = Rel Bal × Unit Price.</p><p>Actual = SUM(Accounting_v_AR_Invoice_Dist.Credit - Debit), por Invoice_Date. Forecast y Actual se mantienen separados.</p></section>}
    <SummaryTable title="Revenue by Release Type" groups={byType}/>
    <SummaryTable title="Revenue by Customer" groups={byCustomer}/>
    <SummaryTable title="Revenue by Part" groups={byPart}/>
    <section className="warehouse-forecast-section" style={panel}><h3>Revenue by Ship Date</h3><table style={tableStyle}><thead><tr><th style={th}>Ship Date</th><th style={th}>Release Qty</th><th style={th}>Daily Revenue</th><th style={th}>Accumulated</th><th style={th}>Unpriced</th></tr></thead><tbody>{daily.map(d => <tr key={d.key}><td style={td}>{d.key}</td><td style={td}>{qty(d.qty)}</td><td style={td}>{money(d.revenue)}</td><td style={td}>{money(d.accumulated)}</td><td style={td}>{d.missing}</td></tr>)}</tbody></table></section>
    <section className="warehouse-forecast-section" style={panel}><h3>Release detail / price audit</h3><table style={tableStyle}><thead><tr>{["Release","PO","Customer","Part","Type","Ship Date","Rel Qty","Balance","Unit Price","Forecast","Price Key",...(debug ? ["Debug"] : [])].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.Release_Key}><td style={td}>{r.Release_Key}</td><td style={td}>{r.PO_No}</td><td style={td}>{r.Customer_No}</td><td style={td}>{r.Part_No_Rev}</td><td style={td}>{r.Release_Type}</td><td style={td}>{r.Ship_Date}</td><td style={td}>{qty(r.Rel_Qty)}</td><td style={td}>{qty(r.Rel_Bal)}</td><td style={td}>{r.Unit_Price === null ? "N/A" : money(r.Unit_Price)}</td><td style={td} title={r.Price_Issue ?? ""}>{r.Forecast_Revenue === null ? "N/A" : money(r.Forecast_Revenue)}</td><td style={td}>{r.Price_Key ?? "—"}</td>{debug && <td style={td}><button className="warehouse-audit-button" type="button" onClick={() => setSelectedRelease(r.Release_Key)}>Inspeccionar</button></td>}</tr>)}</tbody></table></section>
    {debug && selectedRow && <section className="warehouse-forecast-section" style={panel}><h3>Auditoría Release_Key {selectedRow.Release_Key}</h3>
      <p>PO: {selectedRow.PO_No}; PO_Line_Key: {selectedRow.PO_Line_Key}; Price_Key: {selectedRow.Price_Key ?? "N/A"}; Issue: {selectedRow.Price_Issue ?? "Ninguno"}</p>
      {selectedRow.Debug ? <>
        <p>{selectedRow.Debug.Selection_Rule}</p>
        <p>Precios candidatos: {selectedRow.Debug.Candidate_Count}; elegibles: {selectedRow.Debug.Eligible_Count}; unidad: {selectedRow.Debug.Price_Unit ?? "N/A"}; moneda: {selectedRow.Debug.Currency_Key ?? "N/A"}; conversión: {selectedRow.Debug.Price_Conversion_Raw ?? "NULL"}</p>
        <h4>Origen de campos</h4><table style={tableStyle}><tbody>{Object.entries(selectedRow.Debug.Field_Sources).map(([field,source]) => <tr key={field}><td style={td}>{field}</td><td style={td}>{source}</td></tr>)}</tbody></table>
        <h4>Sales_v_Price: precios considerados</h4><table style={tableStyle}><thead><tr><th style={th}>Price_Key</th><th style={th}>Price</th><th style={th}>Effective Date</th><th style={th}>Expiration Date</th><th style={th}>Active</th><th style={th}>Breakpoint</th><th style={th}>Status</th><th style={th}>Reasons</th></tr></thead><tbody>{selectedRow.Debug.Candidates.map(p => <tr key={p.Price_Key}><td style={td}>{p.Price_Key}</td><td style={td}>{p.Price ?? "NULL"}</td><td style={td}>{p.Effective_Date ?? "NULL"}</td><td style={td}>{p.Expiration_Date ?? "NULL"}</td><td style={td}>{p.Active}</td><td style={td}>{p.Breakpoint_Quantity}</td><td style={td}>{p.Price_Key === selectedRow.Price_Key ? "SELECTED" : p.Selection_Status}</td><td style={td}>{p.Exclusion_Reasons.join(", ") || "—"}</td></tr>)}</tbody></table>
      </> : <p>Recarga el reporte con Modo diagnóstico activado.</p>}
    </section>}
  </main>;
}
