import { useMemo, useState } from "react";

export type RevenueAuditRow = {
  Coincidence?: { Exact_Group_Size: number; Exact_Release_Keys: number[]; Overlap_Group_Size: number; Other_Release_Types: string[]; Classification: string; Review_Required: boolean; Confirmed_Duplicate: boolean };
  Release_Key: number;
  PO_Line_Key: number;
  PO_No: string;
  Customer_No: number;
  Part_No_Rev: string;
  Release_Type: string;
  Ship_Date: string;
  Rel_Qty: number;
  Shipped: number;
  Rel_Bal: number;
  Unit_Price: number | null;
  Forecast_Revenue: number | null;
  Remaining_Revenue: number | null;
  Price_Key: number | null;
  Price_Issue: string | null;
};

export type RevenueKpi = "releases" | "forecast" | "remaining" | "missing";

const fmt = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const cell: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const heading: React.CSSProperties = { ...cell, background: "var(--color-bg)", color: "var(--color-text-secondary)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 };

const definitions: Record<RevenueKpi, { name: string; source: string; formula: string }> = {
  releases: {
    name: "Releases",
    source: "Una fila por Sales_v_Release.Release_Key, relacionada por PO_Line_Key con Sales_v_PO_Line y Sales_v_PO.",
    formula: "COUNT(filas recibidas). Se aplica el rango de Sales_v_Release.Ship_Date, status y customer antes de contar.",
  },
  forecast: {
    name: "Forecast Revenue",
    source: "Sales_v_Release.Quantity y Sales_v_Price.Price; precio seleccionado por PO_Line_Key, vigencia y validaciones.",
    formula: "SUM(Rel_Qty × Unit_Price) de los releases con precio verificado. Las filas sin precio no aportan importe.",
  },
  remaining: {
    name: "Remaining Revenue",
    source: "Sales_v_Release.Quantity, Sales_v_Release.Quantity_Shipped y Sales_v_Price.Price.",
    formula: "SUM((Rel_Qty − Shipped) × Unit_Price) de los releases con precio verificado.",
  },
  missing: {
    name: "Sin precio verificable",
    source: "Sales_v_Price y Sales_v_PO_Line.Price_Conversion; se revisan fecha, estado, escala, unidad y moneda.",
    formula: "COUNT(filas donde Unit_Price o Forecast_Revenue es NULL). Son releases, no una cantidad de piezas.",
  },
};

export default function RevenueKpiAudit({
  rows, metric, onClose, onInspect,
}: {
  rows: RevenueAuditRow[];
  metric: RevenueKpi;
  onClose: () => void;
  onInspect: (key: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const [onlyCoincidences, setOnlyCoincidences] = useState(false);
  const selected = definitions[metric];
  const missing = rows.filter(r => r.Unit_Price === null || r.Forecast_Revenue === null);
  const priced = rows.filter(r => r.Unit_Price !== null && r.Forecast_Revenue !== null);
  const base = metric === "missing" ? missing : rows;
  const visible = useMemo(() => base.filter(row => {
    if (onlyExceptions && row.Unit_Price !== null && row.Forecast_Revenue !== null) return false;
    if (onlyCoincidences && !row.Coincidence?.Review_Required) return false;
    const needle = search.trim().toLowerCase();
    return !needle || [row.Release_Key, row.PO_Line_Key, row.PO_No, row.Customer_No,
      row.Part_No_Rev, row.Release_Type, row.Price_Key].some(value =>
      String(value ?? "").toLowerCase().includes(needle));
  }), [base, onlyExceptions, onlyCoincidences, search]);
  const count = rows.length;
  const candidates = rows.filter(r => r.Coincidence?.Review_Required);
  const candidateRevenue = candidates.reduce((sum,r) => sum + (r.Forecast_Revenue ?? 0),0);
  const forecast = rows.reduce((sum, row) => sum + (row.Forecast_Revenue ?? 0), 0);
  const remaining = rows.reduce((sum, row) => sum + (row.Remaining_Revenue ?? 0), 0);
  const quantity = rows.reduce((sum, row) => sum + Number(row.Rel_Qty ?? 0), 0);
  const shipped = rows.reduce((sum, row) => sum + Number(row.Shipped ?? 0), 0);
  const balance = rows.reduce((sum, row) => sum + Number(row.Rel_Bal ?? 0), 0);
  const amount = metric === "releases" ? String(count) : metric === "missing" ? String(missing.length)
    : money(metric === "forecast" ? forecast : remaining);
  const sumVisible = visible.reduce((sum, row) => sum + (
    metric === "forecast" ? row.Forecast_Revenue ?? 0 : metric === "remaining" ? row.Remaining_Revenue ?? 0 : 0
  ), 0);

  return <section className="warehouse-forecast-section" style={{
    background: "var(--color-surface)", border: "1px solid var(--color-primary)",
    borderRadius: "var(--radius-lg)", padding: "1.25rem", minWidth: 0,
  }}>
    <div style={{ display: "flex", gap: 12, alignItems: "start", justifyContent: "space-between" }}>
      <div><h3>Auditoría del KPI: {selected.name}</h3>
        <strong style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}>{amount}</strong>
      </div>
      <button className="warehouse-audit-button" type="button" onClick={onClose}>Cerrar</button>
    </div>
    <p className="warehouse-muted"><strong>Origen:</strong> {selected.source}</p>
    <p className="warehouse-muted"><strong>Fórmula:</strong> {selected.formula}</p>
    <div className="warehouse-metric-grid" style={{ margin: "1rem 0" }}>
      {[
        ["Releases recibidos", fmt(count)],
        ["Con precio", fmt(priced.length)],
        ["Sin precio", fmt(missing.length)],
        ["Rel Qty", fmt(quantity)],
        ["Shipped", fmt(shipped)],
        ["Rel Bal", fmt(balance)],
        ["Σ Forecast", money(forecast)],
        ["Σ Remaining", money(remaining)],
      ].map(([label, value]) => <div key={label} className="warehouse-metric"><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <p className="warehouse-muted"><strong>Coincidencias para revisar:</strong> {candidates.length} releases por {money(candidateRevenue)} (importe bruto asociado, NO significa duplicación confirmada). El cálculo oficial no cambia.</p>
    <p className="warehouse-muted">El total se obtiene de los valores sin redondear de la respuesta del API; la interfaz redondea solo la presentación. Los releases sin precio aparecen en la tabla y no se convierten en $0 verificados.</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
      <input aria-label="Buscar release" placeholder="Buscar Release, PO, parte o cliente…" value={search}
        onChange={e => setSearch(e.target.value)} style={{ padding: 9, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text-primary)", borderRadius: 6, minWidth: 270 }}/>
      {metric !== "missing" && <label className="warehouse-muted"><input type="checkbox" checked={onlyExceptions} onChange={e => setOnlyExceptions(e.target.checked)}/> Solo sin precio</label>}
      <label className="warehouse-muted"><input type="checkbox" checked={onlyCoincidences} onChange={e => setOnlyCoincidences(e.target.checked)}/> Solo coincidencias</label>
      <span className="warehouse-muted">Filas visibles: {visible.length} / {base.length}</span>
      {(metric === "forecast" || metric === "remaining") && <span className="warehouse-muted">Subtotal visible: {money(sumVisible)}</span>}
    </div>
    <div style={{ overflowX: "auto", maxHeight: 540 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>{["Release_Key", "PO_Line_Key", "PO", "Customer", "Part / Rev", "Type", "Ship Date", "Rel Qty", "Shipped", "Rel Bal", "Price_Key", "Unit Price", "Forecast", "Remaining", "Diagnóstico", "Coincidencia", "IDs relacionados", ""].map(column => <th key={column} style={heading}>{column}</th>)}</tr></thead>
        <tbody>{visible.map(row => <tr key={row.Release_Key}>
          <td style={cell}>{row.Release_Key}</td><td style={cell}>{row.PO_Line_Key}</td>
          <td style={cell}>{row.PO_No}</td><td style={cell}>{row.Customer_No}</td>
          <td style={cell}>{row.Part_No_Rev}</td><td style={cell}>{row.Release_Type}</td><td style={cell}>{row.Ship_Date}</td>
          <td style={cell}>{fmt(row.Rel_Qty)}</td><td style={cell}>{fmt(row.Shipped)}</td><td style={cell}>{fmt(row.Rel_Bal)}</td>
          <td style={cell}>{row.Price_Key ?? "N/A"}</td><td style={cell}>{row.Unit_Price === null ? "N/A" : fmt(row.Unit_Price)}</td>
          <td style={cell}>{row.Forecast_Revenue === null ? "Sin precio" : money(row.Forecast_Revenue)}</td>
          <td style={cell}>{row.Remaining_Revenue === null ? "Sin precio" : money(row.Remaining_Revenue)}</td>
          <td style={{ ...cell, color: row.Price_Issue ? "var(--color-stopped)" : "var(--color-running)" }}>{row.Price_Issue ?? "Validado"}</td>
          <td style={cell}>{row.Coincidence?.Classification ?? "Activa Debug y actualiza"}</td>
          <td style={cell}>{row.Coincidence?.Exact_Release_Keys.join(", ") ?? "—"}{row.Coincidence?.Other_Release_Types.length ? " | Tipos: " + row.Coincidence.Other_Release_Types.join(", ") : ""}</td>
          <td style={cell}><button className="warehouse-audit-button" type="button" onClick={() => onInspect(row.Release_Key)}>Inspeccionar</button></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
