import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CogpService, CogpMappingRow } from "../services/cogp.service";

const BU_OPTIONS = ["VOLVO", "CUMMINS", "TULC", "JOHN_DEERE", "HARLEY_DAVIDSON", "EATON", "SPEED"];

const SOURCE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  CUSTOMER_NO:   { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "Customer_No" },
  NAME_FALLBACK: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", label: "Nombre" },
  UNMAPPED:      { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", label: "Sin mapear" },
};

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg, 10px)",
  padding: "1.25rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.6rem", fontSize: "0.8rem",
  borderRadius: "var(--radius-sm, 6px)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "0.4rem 0.6rem", fontWeight: 700,
  color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap", fontSize: "0.72rem",
};

const tdStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem", color: "var(--color-text-primary)",
  borderBottom: "1px solid var(--color-border)", fontSize: "0.78rem",
};

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_BADGE[source] ?? SOURCE_BADGE.UNMAPPED;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: "0.15rem 0.5rem", borderRadius: 6,
      fontSize: "0.68rem", fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  );
}

export default function CogpMappingPage() {
  const { t } = useTranslation();

  const [rows, setRows] = useState<CogpMappingRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buFilter, setBuFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CogpService.getMappingCatalog({
        business_unit: buFilter || undefined,
        search: search || undefined,
      });
      setRows(result.results);
      setCount(result.count);
    } catch {
      setError(t("cogpDashboard.loadError"));
    } finally {
      setLoading(false);
    }
  }, [buFilter, search, t]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
          {t("cogpMapping.title")}
        </h1>
        <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.2rem 0 0" }}>
          {t("cogpMapping.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <select style={inputStyle} value={buFilter} onChange={e => setBuFilter(e.target.value)}>
          <option value="">{t("cogpMapping.allBUs")}</option>
          {BU_OPTIONS.map(bu => <option key={bu} value={bu}>{bu}</option>)}
        </select>

        <input
          type="text"
          placeholder={t("cogpMapping.searchPlaceholder")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") load(); }}
          style={{ ...inputStyle, minWidth: 220 }}
        />

        <button onClick={load} disabled={loading}
          style={{ ...inputStyle, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
          {loading ? "..." : t("cogpMapping.search")}
        </button>

        <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginLeft: "auto" }}>
          {count} {t("cogpMapping.results")}
        </span>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "8px", color: "#ef4444", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--color-surface)", zIndex: 1 }}>
              <tr>
                <th style={thStyle}>{t("cogpMapping.columns.partNo")}</th>
                <th style={thStyle}>{t("cogpMapping.columns.partName")}</th>
                <th style={thStyle}>{t("cogpMapping.columns.customerNo")}</th>
                <th style={thStyle}>{t("cogpMapping.columns.customerName")}</th>
                <th style={thStyle}>{t("cogpMapping.columns.businessUnit")}</th>
                <th style={thStyle}>{t("cogpMapping.columns.source")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.part_no}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{r.part_no}</td>
                  <td style={tdStyle}>{r.part_name}</td>
                  <td style={tdStyle}>{r.customer_no ?? "—"}</td>
                  <td style={tdStyle}>{r.customer_name || "—"}</td>
                  <td style={tdStyle}>{r.business_unit}</td>
                  <td style={tdStyle}><SourceBadge source={r.classification_source} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
              {t("cogpMapping.noData")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}