import { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { WarehouseService, DemandRow, CUSTOMERS } from "./services/warehouse.service";

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
  const [rows, setRows]               = useState<DemandRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchDemand = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await WarehouseService.getDemand(customerNo, status);
      setRows(data);
    } catch {
      setError(t("warehouse.demand.errorFetching"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDemand(); }, []);

  const grouped = rows.reduce<Record<string, DemandRow[]>>((acc, row) => {
    if (!acc[row.Customer]) acc[row.Customer] = [];
    acc[row.Customer].push(row);
    return acc;
  }, {});

  return (
    <div style={styles.page}>
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
                {opt.label}
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

      {Object.entries(grouped).map(([customer, customerRows]) => (
        <div key={customer} style={styles.tableWrap}>
          <div style={styles.tableHeader}>
            <div style={styles.customerHeader}>
              <Icons.Building2 size={16} style={{ color: "var(--color-primary)" }} />
              <span style={styles.tableTitle}>{customer}</span>
              <span style={styles.tableCount}>{customerRows.length} releases</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["PO", "Status", t("warehouse.demand.colPart"), t("warehouse.demand.colCustPart"),
                    t("warehouse.demand.colQtyReady"), "WIP", t("warehouse.demand.colShipDate"),
                    t("warehouse.demand.colDueDate"), t("warehouse.demand.colRelQty"),
                    t("warehouse.demand.colShipped"), t("warehouse.demand.colBalance"),
                    t("warehouse.demand.colRelStatus"), t("warehouse.demand.colRelType"),
                  ].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customerRows.map((row, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={{ ...styles.td, fontFamily: "monospace", fontSize: "0.8rem" }}>{row.PO_Rel || "—"}</td>
                    <td style={styles.td}>
                      <span style={{
                        padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "600",
                        backgroundColor: row.PO_Status === "Open" ? "rgba(22,163,74,0.1)" : "rgba(107,114,128,0.1)",
                        color: row.PO_Status === "Open" ? "var(--color-running)" : "var(--color-text-secondary)",
                      }}>
                        {row.PO_Status || "Open"}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontFamily: "monospace", fontSize: "0.8rem" }}>{row.Part_No_Rev}</td>
                    <td style={styles.td}>{row.Cust_Part || "—"}</td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: "600" }}>{row.Qty_Ready?.toLocaleString()}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{row.Qty_WIP?.toLocaleString()}</td>
                    <td style={styles.td}>{formatDate(row.Ship_Date)}</td>
                    <td style={styles.td}>{formatDate(row.Due_Date)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{row.Rel_Qty?.toLocaleString()}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{row.Shipped?.toLocaleString()}</td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: "600", color: row.Rel_Bal > 0 ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
                      {row.Rel_Bal?.toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "600",
                        backgroundColor: row.Rel_Status === "Open" ? "rgba(22,163,74,0.1)" : "rgba(107,114,128,0.1)",
                        color: row.Rel_Status === "Open" ? "var(--color-running)" : "var(--color-text-secondary)",
                      }}>
                        {row.Rel_Status}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontSize: "0.775rem", color: "var(--color-text-secondary)" }}>{row.Rel_Type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:          { display: "flex", flexDirection: "column", gap: "1.25rem" },
  filterBar:     { display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "flex-end", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem 1.5rem" },
  filterGroup:   { display: "flex", flexDirection: "column", gap: "0.375rem" },
  filterLabel:   { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
  select:        { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "200px" },
  segmentGroup:  { display: "flex", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", overflow: "hidden" },
  segmentBtn:    { padding: "0.55rem 1rem", border: "none", borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500" },
  segmentActive: { backgroundColor: "var(--color-primary)", color: "#fff" },
  loadBtn:       { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.55rem 1.25rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
  summaryBadge:  { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.875rem", borderRadius: "999px", backgroundColor: "rgba(10,110,189,0.08)", color: "var(--color-primary)", fontSize: "0.8rem", fontWeight: "600", marginTop: "1.5rem" },
  errorMsg:      { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--color-stopped)", fontSize: "0.875rem" },
  tableWrap:     { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  tableHeader:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  customerHeader:{ display: "flex", alignItems: "center", gap: "0.625rem" },
  tableTitle:    { fontSize: "0.9rem", fontWeight: "700", color: "var(--color-text-primary)" },
  tableCount:    { fontSize: "0.8rem", color: "var(--color-text-secondary)", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" },
  table:         { width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" },
  th:            { padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.725rem", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  td:            { padding: "0.6rem 1rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)" },
  trEven:        { backgroundColor: "transparent" },
  trOdd:         { backgroundColor: "var(--color-bg)" },
};