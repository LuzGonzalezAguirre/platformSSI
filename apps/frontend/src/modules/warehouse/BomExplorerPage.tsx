import { useState } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { WarehouseService, BomRow, PartRevision } from "./services/warehouse.service";

const LEVEL_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626"];

function levelColor(level: number): string {
  return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];
}

export default function BomExplorerPage() {
  const { t } = useTranslation();
  const [partNo, setPartNo]         = useState("");
  const [revisions, setRevisions]   = useState<PartRevision[]>([]);
  const [revision, setRevision]     = useState("");
  const [rows, setRows]             = useState<BomRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [loadingRevs, setLoadingRevs] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSearchRevisions = async () => {
    if (!partNo.trim()) return;
    setLoadingRevs(true);
    setError(null);
    setRevisions([]);
    setRows([]);
    setRevision("");
    try {
      const data = await WarehouseService.getPartRevisions(partNo.trim());
      if (data.length === 0) {
        setError(t("warehouse.bom.noPartFound"));
      } else {
        setRevisions(data);
        setRevision(data[0].Revision);
      }
    } catch {
      setError(t("warehouse.bom.errorFetching"));
    } finally {
      setLoadingRevs(false);
    }
  };

  const handleLoadBom = async () => {
    if (!partNo.trim() || !revision) return;
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const data = await WarehouseService.getBomHierarchy(partNo.trim(), revision);
      if (data.length === 0) setError(t("warehouse.bom.noBomFound"));
      else setRows(data);
    } catch {
      setError(t("warehouse.bom.errorFetching"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Filtros superiores */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t("warehouse.bom.partNumber")}</label>
          <div style={styles.filterInputRow}>
            <input
              style={styles.input}
              value={partNo}
              onChange={(e) => setPartNo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchRevisions()}
              placeholder="43309.3"
            />
            <button style={styles.searchBtn} onClick={handleSearchRevisions} disabled={loadingRevs}>
              {loadingRevs
                ? <Icons.Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                : <Icons.Search size={15} />
              }
              <span>{t("warehouse.bom.search")}</span>
            </button>
          </div>
        </div>

        {revisions.length > 0 && (
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>{t("warehouse.bom.revision")}</label>
            <select
              style={styles.select}
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
            >
              {revisions.map((r) => (
                <option key={r.Revision} value={r.Revision}>
                  Rev {r.Revision} — {r.Part_Name}
                </option>
              ))}
            </select>
          </div>
        )}

        {revision && (
          <div style={{ ...styles.filterGroup, justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <button style={styles.loadBtn} onClick={handleLoadBom} disabled={loading}>
              {loading
                ? <Icons.Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                : <Icons.GitBranch size={15} />
              }
              <span>{loading ? t("common.loading") : t("warehouse.bom.loadBom")}</span>
            </button>
          </div>
        )}
      </div>

      {error && <div style={styles.errorMsg}>{error}</div>}

      {rows.length > 0 && (
        <div style={styles.tableWrap}>
          <div style={styles.tableHeader}>
            <span style={styles.tableTitle}>
              {rows[0]?.original_part_no} — {rows[0]?.original_part_name}
            </span>
            <span style={styles.tableCount}>{rows.length} {t("warehouse.bom.components")}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Lvl", t("warehouse.bom.colPartNo"), t("warehouse.bom.colPartName"),
                    t("warehouse.bom.colQty"), t("warehouse.bom.colUnit"),
                    t("warehouse.bom.colNote"), t("warehouse.bom.colPath")
                  ].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.levelBadge,
                        backgroundColor: levelColor(row.level) + "20",
                        color: levelColor(row.level),
                        borderColor: levelColor(row.level) + "40",
                      }}>
                        {row.level}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {row.part_no_rev}
                    </td>
                    <td style={styles.td}>{row.part_name}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{row.quantity}</td>
                    <td style={styles.td}>{row.unit}</td>
                    <td style={{ ...styles.td, color: "var(--color-text-secondary)", fontSize: "0.775rem" }}>
                      {row.note || "—"}
                    </td>
                    <td style={{ ...styles.td, color: "var(--color-text-secondary)", fontSize: "0.75rem", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.bom_path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:        { display: "flex", flexDirection: "column", gap: "1.25rem" },
  filterBar:   { display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "flex-end", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem 1.5rem" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "200px" },
  filterLabel: { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
  filterInputRow: { display: "flex", gap: "0.5rem" },
  input:       { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "160px" },
  select:      { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "260px" },
  searchBtn:   { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.55rem 1rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", whiteSpace: "nowrap" },
  loadBtn:     { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.55rem 1.25rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
  errorMsg:    { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--color-stopped)", fontSize: "0.875rem" },
  tableWrap:   { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  tableHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  tableTitle:  { fontSize: "0.9rem", fontWeight: "700", color: "var(--color-text-primary)" },
  tableCount:  { fontSize: "0.8rem", color: "var(--color-text-secondary)" },
  table:       { width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" },
  th:          { padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.725rem", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  td:          { padding: "0.6rem 1rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)" },
  trEven:      { backgroundColor: "transparent" },
  trOdd:       { backgroundColor: "var(--color-bg)" },
  levelBadge:  { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700", border: "1px solid" },
};