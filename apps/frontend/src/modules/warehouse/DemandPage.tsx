import "./warehouse-unified.css";
import { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { WarehouseService, DemandRow, CUSTOMERS, DEMAND_RELEASE_TYPES, type DemandFilters } from "./services/warehouse.service";

const STATUS_OPTIONS = [
  { label: "Open",    value: "Open"    },
  { label: "History", value: "History" },
  { label: "All",     value: "All"     },
];

function formatDate(val: string | null): string {
  if (!val) return "—";
  return val.split("T")[0];
}

export default function DemandPage() {
  const { t }                         = useTranslation();
  const [customerNo, setCustomerNo]   = useState<number | null>(null);
  const [status, setStatus]           = useState("Open");
  const [shipDateFrom, setShipDateFrom] = useState("");
  const [shipDateTo, setShipDateTo] = useState("");
  const [po, setPo]                 = useState("");
  const [customerPartNo, setCustomerPartNo] = useState("");
  const [releaseType, setReleaseType] = useState("All");
  const [rows, setRows]               = useState<DemandRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchDemand = async () => {
    if (Boolean(shipDateFrom) !== Boolean(shipDateTo)) {
      setError(t("warehouse.demand.bothDatesRequired"));
      return;
    }
    if (shipDateFrom && shipDateTo) {
      const days = (Date.parse(shipDateTo + "T00:00:00Z") - Date.parse(shipDateFrom + "T00:00:00Z")) / 86400000;
      if (!Number.isFinite(days) || days < 0 || days > 180) {
        setError(t("warehouse.demand.invalidDateRange"));
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const filters: DemandFilters = {
        customerNo, status: status as DemandFilters["status"], shipDateFrom,
        shipDateTo, po, customerPartNo, releaseTypes: releaseType === "All" ? [] : [releaseType],
      };
      const data = await WarehouseService.getDemand(filters);
      setRows(data);
    } catch {
      setRows([]);
      setError(t("warehouse.demand.errorFetching"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDemand(); }, []);

  const sortedRows = [...rows].sort((a, b) =>
    a.Customer.localeCompare(b.Customer) ||
    (a.Ship_Date ?? "").localeCompare(b.Ship_Date ?? "") ||
    a.Part_No_Rev.localeCompare(b.Part_No_Rev)
  );

  return (
    <div className="warehouse-unified" style={styles.page}>
      <div className="warehouse-heading">
        <span className="warehouse-heading-icon"><Icons.ClipboardList size={23}/></span>
        <div><h1>Demand</h1><p>Consulta de liberaciones, cantidades pendientes y disponibilidad para embarque.</p></div>
      </div>
      {/* Filtros superiores */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t("warehouse.demand.customer")}</label>
          <select
            style={styles.select}
            value={customerNo ?? ""}
            onChange={(e) => setCustomerNo(e.target.value === "" ? null : parseInt(e.target.value))}
          >
            {CUSTOMERS.map((c: { label: string; value: number | null }) => (
              <option key={c.label} value={c.value ?? ""}>{c.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t("warehouse.demand.shipDateFrom")}</label>
          <input type="date" value={shipDateFrom} onChange={(e) => setShipDateFrom(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t("warehouse.demand.shipDateTo")}</label>
          <input type="date" value={shipDateTo} onChange={(e) => setShipDateTo(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>PO</label>
          <input type="text" value={po} maxLength={100} onChange={(e) => setPo(e.target.value)} style={styles.input} placeholder={t("warehouse.demand.poPlaceholder")} />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t("warehouse.demand.customerPartNo")}</label>
          <input type="text" value={customerPartNo} maxLength={100} onChange={(e) => setCustomerPartNo(e.target.value)} style={styles.input} placeholder={t("warehouse.demand.customerPartPlaceholder")} />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t("warehouse.demand.releaseType")}</label>
          <select
            value={releaseType}
            onChange={(e) => setReleaseType(e.target.value)}
            style={styles.select}
            aria-label={t("warehouse.demand.releaseType")}
          >
            <option value="All">All</option>
            {DEMAND_RELEASE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t("warehouse.demand.status")}</label>
          <div style={styles.segmentGroup}>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                style={{
                  ...styles.segmentBtn,
                  ...(status === opt.value ? styles.segmentActive : {}),
                }}
                onClick={() => setStatus(opt.value)}
              >
                {t(`warehouse.demand.status${opt.value}`)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...styles.filterGroup, justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button style={styles.loadBtn} onClick={fetchDemand} disabled={loading}>
            {loading
              ? <Icons.Loader2 size={15} />
              : <Icons.RefreshCw size={15} />
            }
            <span>{loading ? t("common.loading") : t("warehouse.demand.refresh")}</span>
          </button>
        </div>

        {rows.length > 0 && (
          <div style={styles.summaryBadge}>
            <Icons.Package size={14} />
            <span>{rows.length} {t("warehouse.demand.releases")}</span>
          </div>
        )}
      </div>

      {error && <div style={styles.errorMsg}>{error}</div>}

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <div style={styles.customerHeader}>
            <Icons.Table2 size={16} style={{ color: "var(--color-primary)" }} />
            <span style={styles.tableTitle}>Customer Releases</span>
            <span style={styles.tableCount}>{rows.length} {t("warehouse.demand.releases")}</span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t("warehouse.demand.customer")}</th>
                <th style={styles.th}>PO</th>
                <th style={styles.th}>Part No / Cust Part</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Qty Ready</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Qty WIP</th>
                <th style={styles.th}>Ship Date / Shipper</th>
                <th style={styles.th}>{t("warehouse.demand.colDueDate")}</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Rel Qty</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Shipped</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Rel Bal</th>
                <th style={styles.th}>Rel Status</th>
                <th style={styles.th}>Rel Type</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => {
                const previous = sortedRows[i - 1];
                const newCustomer = !previous || previous.Customer !== row.Customer;
                const balance = Number(row.Rel_Bal) || 0;
                const ready = Number(row.Qty_Ready) || 0;
                const wip = Number(row.Qty_WIP) || 0;
                return (
                  <tr key={i} style={{
                    backgroundColor: newCustomer ? "var(--color-bg)" : "transparent",
                    borderTop: newCustomer && i > 0 ? "2px solid var(--color-border)" : undefined,
                  }}>
                    <td style={{ ...styles.td, minWidth: "150px" }}>
                      {newCustomer && <span style={styles.customerName}>{row.Customer}</span>}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{row.PO_Rel || "—"}</td>
                    <td style={styles.td}>
                      <div style={styles.stackedCell}>
                        <span style={{ fontWeight: 600 }}>{row.Part_No_Rev}</span>
                        {row.Cust_Part && <span style={styles.secondaryCell}>{row.Cust_Part}</span>}
                      </div>
                    </td>
                    <td style={{ ...styles.numericCell, color: ready > 0 ? "var(--color-running)" : "var(--color-text-secondary)", fontWeight: ready > 0 ? 700 : 400 }}>
                      {ready.toLocaleString()}
                    </td>
                    <td style={{ ...styles.numericCell, color: wip > 0 ? "var(--color-primary)" : "var(--color-text-secondary)", fontWeight: wip > 0 ? 600 : 400 }}>
                      {wip.toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.stackedCell}>
                        <span>{formatDate(row.Ship_Date)}</span>
                        {row.Shipper_No && <span style={styles.secondaryCell}>{row.Shipper_No}</span>}
                      </div>
                    </td>
                    <td style={styles.td}>{formatDate(row.Due_Date)}</td>
                    <td style={styles.numericCell}>{row.Rel_Qty?.toLocaleString() ?? "—"}</td>
                    <td style={styles.numericCell}>{row.Shipped?.toLocaleString() ?? "—"}</td>
                    <td style={{ ...styles.numericCell, fontWeight: 700 }}>{balance.toLocaleString()}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusPill,
                        backgroundColor: row.Rel_Status === "Open" ? "rgba(22,163,74,0.10)" :
                          row.Rel_Status === "Scheduled" ? "rgba(59,130,246,0.10)" : "var(--color-bg)",
                        color: row.Rel_Status === "Open" ? "var(--color-running)" :
                          row.Rel_Status === "Scheduled" ? "var(--color-primary)" : "var(--color-text-secondary)",
                      }}>{row.Rel_Status || "—"}</span>
                    </td>
                    <td style={styles.td}>{row.Rel_Type || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:          { display: "flex", flexDirection: "column", gap: "1.25rem", padding: "0 1rem 2rem", minWidth: 0 },
  filterBar:     { display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem 1.5rem" },
  filterGroup:   { display: "flex", flexDirection: "column", gap: "0.375rem" },
  filterLabel:   { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
  input:         { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "160px" },
  select:        { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "200px" },
  segmentGroup:  { display: "flex", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", overflow: "hidden" },
  segmentBtn:    { padding: "0.55rem 1rem", border: "none", borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500" },
  segmentActive: { backgroundColor: "var(--color-primary)", color: "#fff" },
  loadBtn:       { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.55rem 1.25rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
  summaryBadge:  { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.875rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-primary)", fontSize: "0.8rem", fontWeight: "600", marginTop: "1.5rem" },
  notice:        { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", fontSize: "0.8rem" },
  errorMsg:      { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--color-stopped)", fontSize: "0.875rem" },
  tableWrap:     { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  tableHeader:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  customerHeader:{ display: "flex", alignItems: "center", gap: "0.625rem" },
  tableTitle:    { fontSize: "0.9rem", fontWeight: "700", color: "var(--color-text-primary)" },
  tableCount:    { fontSize: "0.8rem", color: "var(--color-text-secondary)", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" },
  table:         { width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" },
  customerName:  { display: "inline-block", fontWeight: 700, color: "var(--color-text-primary)" },
  statusPill:    { display: "inline-block", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.75rem", fontWeight: 600 },
  th:            { padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.725rem", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  td:            { padding: "0.5rem 0.7rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)" },
  trEven:        { backgroundColor: "transparent" },
  trOdd:         { backgroundColor: "var(--color-bg)" },
  numericCell:   { padding: "0.5rem 0.7rem", textAlign: "right", whiteSpace: "nowrap", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)", fontVariantNumeric: "tabular-nums" },
  stackedCell:   { display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: "8rem" },
  secondaryCell: { color: "var(--color-text-secondary)", fontSize: "0.76rem" },
};