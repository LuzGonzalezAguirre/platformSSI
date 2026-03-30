import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { WarehouseService, CtbRow, PartRevision } from "./services/warehouse.service";

const LEVEL_COLORS = [
  { bg: "#2563eb", light: "rgba(37,99,235,0.15)" },
  { bg: "#7c3aed", light: "rgba(124,58,237,0.15)" },
  { bg: "#059669", light: "rgba(5,150,105,0.15)"  },
  { bg: "#d97706", light: "rgba(217,119,6,0.15)"  },
  { bg: "#dc2626", light: "rgba(220,38,38,0.15)"  },
];
function lc(level: number) { return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length]; }

const INDENT = 24;

function TreeCell({ row, isLastAtLevel }: { row: CtbRow; isLastAtLevel: boolean[] }) {
  const depth = row.level - 1;
  const color = lc(row.level);

  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative", minHeight: "36px" }}>
      {/* Guías verticales de ancestros */}
      {Array.from({ length: depth }).map((_, i) => (
        !isLastAtLevel[i] ? (
          <div key={i} style={{
            position: "absolute",
            left: i * INDENT + 10,
            top: 0, bottom: 0,
            width: "1.5px",
            backgroundColor: "var(--color-border)",
          }} />
        ) : null
      ))}

      {/* Conector del nodo actual */}
      {depth > 0 && (
        <>
          <div style={{
            position: "absolute",
            left: (depth - 1) * INDENT + 10,
            top: 0, height: "50%",
            width: "1.5px",
            backgroundColor: "var(--color-border)",
          }} />
          <div style={{
            position: "absolute",
            left: (depth - 1) * INDENT + 10,
            top: "50%",
            width: INDENT - 4,
            height: "1.5px",
            backgroundColor: "var(--color-border)",
          }} />
        </>
      )}

      {/* Contenido */}
      <div style={{
        marginLeft: depth * INDENT + (depth > 0 ? INDENT - 2 : 0),
        display: "flex", alignItems: "center", gap: "0.45rem",
        position: "relative", zIndex: 1,
      }}>
        <span style={{
          minWidth: "20px", height: "20px", borderRadius: "4px",
          backgroundColor: color.bg, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.65rem", fontWeight: "800", flexShrink: 0,
        }}>
          {row.level}
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: "600", fontFamily: "monospace", color: "var(--color-text-primary)" }}>
            {row.part_no_rev}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>
            {row.part_name}
          </span>
        </div>
      </div>
    </div>
  );
}

function buildIsLastAtLevel(rows: CtbRow[]): boolean[][] {
  return rows.map((row, i) => {
    const depth = row.level - 1;
    return Array.from({ length: depth }, (_, d) => {
      return !rows.slice(i + 1).some((r) => r.level <= d + 1);
    });
  });
}

export default function ClearToBuildPage() {
  const { t } = useTranslation();

  // Filtros de búsqueda
  const [partNo, setPartNo]           = useState("");
  const [need, setNeed]               = useState(500);
  const [revisions, setRevisions]     = useState<PartRevision[]>([]);
  const [revision, setRevision]       = useState("");
  const [rows, setRows]               = useState<CtbRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingRevs, setLoadingRevs] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Filtros de tabla
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [search, setSearch]           = useState("");
  const [ctbFilter, setCtbFilter]     = useState<"All" | "Yes" | "No">("All");

  const handleSearchRevisions = async () => {
    if (!partNo.trim()) return;
    setLoadingRevs(true);
    setError(null);
    setRevisions([]);
    setRows([]);
    setRevision("");
    try {
      const data = await WarehouseService.getPartRevisions(partNo.trim());
      if (data.length === 0) setError(t("warehouse.ctb.noPartFound"));
      else { setRevisions(data); setRevision(data[0].Revision); }
    } catch { setError(t("warehouse.ctb.errorFetching")); }
    finally { setLoadingRevs(false); }
  };

  const handleLoadCtb = async () => {
    if (!partNo.trim() || !revision) return;
    setLoading(true);
    setError(null);
    setRows([]);
    setFilterLevel(null);
    setSearch("");
    setCtbFilter("All");
    try {
      const data = await WarehouseService.getBomCtb(partNo.trim(), revision, need);
      if (data.length === 0) setError(t("warehouse.ctb.noBomFound"));
      else setRows(data);
    } catch { setError(t("warehouse.ctb.errorFetching")); }
    finally { setLoading(false); }
  };

  const maxLevel     = useMemo(() => Math.max(0, ...rows.map((r) => r.level)), [rows]);
  const uniqueParts  = useMemo(() => new Set(rows.map((r) => r.part_no_rev.split(" ")[0])).size, [rows]);
  const readyCount   = rows.filter((r) => r.ctb === "Yes").length;
  const notReady     = rows.filter((r) => r.ctb === "No").length;
  const readyPct     = rows.length > 0 ? ((readyCount / rows.length) * 100).toFixed(1) : "0.0";
  const isFullyReady = notReady === 0 && rows.length > 0;

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterLevel !== null && r.level !== filterLevel) return false;
      if (search && !r.part_no_rev.toLowerCase().includes(search.toLowerCase()) &&
          !r.part_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (ctbFilter !== "All" && r.ctb !== ctbFilter) return false;
      return true;
    });
  }, [rows, filterLevel, search, ctbFilter]);

  const isLastAtLevelMap = useMemo(() => buildIsLastAtLevel(filteredRows), [filteredRows]);

  return (
    <div style={S.page}>
      {/* ── Filtros superiores ── */}
      <div style={S.filterBar}>
        <div style={S.fg}>
          <label style={S.fl}>{t("warehouse.ctb.partNumber")}</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              style={S.input}
              value={partNo}
              onChange={(e) => setPartNo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchRevisions()}
              placeholder="43309.3"
            />
            <button style={S.btnPrimary} onClick={handleSearchRevisions} disabled={loadingRevs}>
              {loadingRevs ? <Icons.Loader2 size={14} /> : <Icons.Search size={14} />}
              <span>Search</span>
            </button>
          </div>
        </div>

        <div style={S.fg}>
          <label style={S.fl}>{t("warehouse.ctb.need")}</label>
          <input style={{ ...S.input, width: "90px" }} type="number" min={1}
            value={need} onChange={(e) => setNeed(parseInt(e.target.value) || 1)} />
        </div>

        {revisions.length > 0 && (
          <div style={S.fg}>
            <label style={S.fl}>{t("warehouse.ctb.revision")}</label>
            <select style={S.select} value={revision} onChange={(e) => setRevision(e.target.value)}>
              {revisions.map((r) => (
                <option key={r.Revision} value={r.Revision}>
                  Rev {r.Revision} — {r.Part_Name}
                </option>
              ))}
            </select>
          </div>
        )}

        {revision && (
          <div style={{ ...S.fg, justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <button style={S.btnPrimary} onClick={handleLoadCtb} disabled={loading}>
              {loading ? <Icons.Loader2 size={14} /> : <Icons.PackageSearch size={14} />}
              <span>{loading ? t("common.loading") : t("warehouse.ctb.calculate")}</span>
            </button>
          </div>
        )}
      </div>

      {error && <div style={S.errorMsg}>{error}</div>}

      {rows.length > 0 && (
        <>
          {/* ── KPI Cards ── */}
          <div style={S.kpiRow}>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Total Components</div>
              <div style={S.kpiValue}>{rows.length}</div>
              <div style={S.kpiSub}>Part: {partNo}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>BOM Depth</div>
              <div style={S.kpiValue}>{maxLevel}</div>
              <div style={S.kpiSub}>Max level</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Unique Parts</div>
              <div style={S.kpiValue}>{uniqueParts}</div>
              <div style={S.kpiSub}>Distinct part numbers</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Need (qty)</div>
              <div style={S.kpiValue}>{need.toLocaleString()}</div>
              <div style={S.kpiSub}>Root: {partNo} Rev:{revision}</div>
            </div>
            <div style={{
              ...S.kpiCard,
              borderColor: isFullyReady ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)",
              backgroundColor: isFullyReady ? "rgba(22,163,74,0.04)" : "rgba(220,38,38,0.04)",
            }}>
              <div style={S.kpiLabel}>CTB Ready</div>
              <div style={{ ...S.kpiValue, color: isFullyReady ? "var(--color-running)" : "var(--color-stopped)" }}>
                {readyPct}%
              </div>
              <div style={S.kpiSub}>{readyCount} ✓&nbsp;&nbsp;{notReady} ✗</div>
            </div>
          </div>

          {/* ── Filtros de tabla ── */}
          <div style={S.tableFilters}>
            <div style={S.fg}>
              <label style={S.fl}>Filter by Level</label>
              <select style={{ ...S.select, minWidth: "180px" }}
                value={filterLevel ?? ""}
                onChange={(e) => setFilterLevel(e.target.value === "" ? null : parseInt(e.target.value))}>
                <option value="">All levels</option>
                {Array.from({ length: maxLevel }, (_, i) => i + 1).map((l) => (
                  <option key={l} value={l}>Level {l}</option>
                ))}
              </select>
            </div>

            <div style={S.fg}>
              <label style={S.fl}>Search</label>
              <input style={{ ...S.input, minWidth: "260px" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Part number or name..." />
            </div>

            <div style={S.fg}>
              <label style={S.fl}>CTB Filter</label>
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", height: "36px" }}>
                {(["All", "Yes", "No"] as const).map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-primary)" }}>
                    <input type="radio" name="ctbFilter" value={opt}
                      checked={ctbFilter === opt}
                      onChange={() => setCtbFilter(opt)}
                      style={{ accentColor: "var(--color-primary)" }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end" }}>
              <span style={S.rowCount}>{filteredRows.length} of {rows.length} rows</span>
            </div>
          </div>

          {/* ── Tabla jerárquica ── */}
          <div style={S.tableWrap}>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, minWidth: "340px" }}>PART</th>
                    <th style={{ ...S.th, textAlign: "right" }}>WH</th>
                    <th style={{ ...S.th, textAlign: "right" }}>WIP</th>
                    <th style={{ ...S.th, textAlign: "right" }}>INV</th>
                    <th style={{ ...S.th, textAlign: "right" }}>OH</th>
                    <th style={{ ...S.th, textAlign: "center" }}>CTB</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={i} style={{
                      backgroundColor: row.ctb === "No"
                        ? "rgba(220,38,38,0.03)"
                        : i % 2 === 0 ? "transparent" : "var(--color-bg)",
                    }}>
                      

                      {/* PART con árbol */}
                      <td style={{ ...S.td, padding: "0 1rem" }}>
                        <TreeCell row={row} isLastAtLevel={isLastAtLevelMap[i]} />
                      </td>

                      {/* Datos numéricos */}
                      <td style={{ ...S.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {row.ohymv.toLocaleString()}
                      </td>
                      <td style={{ ...S.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {row.wip.toLocaleString()}
                      </td>
                      <td style={{ ...S.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {row.inv.toLocaleString()}
                      </td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                        {row.ohnv.toLocaleString()}
                      </td>

                      {/* CTB badge */}
                      <td style={{ ...S.td, textAlign: "center" }}>
                        {row.ctb === "Yes" ? (
                          <span style={S.ctbYes}>
                            <Icons.CheckCircle2 size={13} />
                            Yes
                          </span>
                        ) : (
                          <span style={S.ctbNo}>
                            <Icons.XCircle size={13} />
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:         { display: "flex", flexDirection: "column", gap: "1.25rem", padding: "0 2rem" },
  filterBar:    { display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "flex-end", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem 1.5rem" },
  tableFilters: { display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-end", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1rem 1.5rem" },
  fg:           { display: "flex", flexDirection: "column", gap: "0.375rem" },
  fl:           { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
  input:        { padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  select:       { padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  btnPrimary:   { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", whiteSpace: "nowrap" },
  errorMsg:     { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--color-stopped)", fontSize: "0.875rem" },
  kpiRow:       { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" },
  kpiCard:      { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1rem 1.25rem" },
  kpiLabel:     { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" },
  kpiValue:     { fontSize: "1.75rem", fontWeight: "700", color: "var(--color-text-primary)", lineHeight: 1.1 },
  kpiSub:       { fontSize: "0.72rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" },
  rowCount:     { fontSize: "0.8rem", color: "var(--color-text-secondary)", padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" },
  tableWrap:    { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" },
  th:           { padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", backgroundColor: "var(--color-bg)", borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap" },
  td:           { padding: "0.45rem 1rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)" },
  ctbYes:       { display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "700", backgroundColor: "rgba(22,163,74,0.1)", color: "var(--color-running)", border: "1px solid rgba(22,163,74,0.25)" },
  ctbNo:        { display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "700", backgroundColor: "rgba(220,38,38,0.1)", color: "var(--color-stopped)", border: "1px solid rgba(220,38,38,0.25)" },
};