import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMaintenanceData } from "./useMaintenanceData";
import { DateRange, DowntimeDetail } from "./types";
import { MaintenanceService } from "./overview.service";
import KPISection           from "./KPISection";
import ProductionMetrics    from "./ProductionMetrics";
import OEETrendChart        from "./OEETrendChart";
import DowntimeStackedChart from "./DowntimeStackedChart";
import DowntimeReasons      from "./DowntimeReasons";

function getDefaultRange(): DateRange {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString().split("T")[0],
    end:   end.toISOString().split("T")[0],
  };
}

export default function OverviewPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [range, setRange] = useState<DateRange>(getDefaultRange());
  const { kpis, reasons, grandTotal, oee, oeeTrend, downtimeMonth, loading, error } = useMaintenanceData(range);

  // Drill-down modal
  const [detailReason,  setDetailReason]  = useState<string | null>(null);
  const [detailRows,    setDetailRows]    = useState<DowntimeDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleViewLogs = async (reason: string) => {
    setDetailReason(reason);
    setDetailRows([]);
    setDetailLoading(true);
    try {
      const res = await MaintenanceService.getDetail(range.start, range.end, reason);
      setDetailRows(res.data);
    } catch {
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const s = styles;

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{lang === "es" ? "Mantenimiento — Overview" : "Maintenance Overview"}</h1>
        </div>
        <div style={s.dateControls}>
          <label style={s.fieldLabel}>{lang === "es" ? "Desde:" : "From:"}</label>
          <input type="date" value={range.start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            style={s.dateInput} />
          <label style={s.fieldLabel}>{lang === "es" ? "Hasta:" : "To:"}</label>
          <input type="date" value={range.end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            style={s.dateInput} />
        </div>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {loading ? (
        <div style={s.loading}>{lang === "es" ? "Cargando datos..." : "Loading data..."}</div>
      ) : (
        <>
          <KPISection      kpis={kpis} oee={oee} lang={lang} />
          <ProductionMetrics kpis={kpis} lang={lang} />
          <OEETrendChart   data={oeeTrend} lang={lang} />
          <DowntimeStackedChart data={downtimeMonth} lang={lang} />
          <DowntimeReasons
            reasons={reasons}
            grandTotal={grandTotal}
            lang={lang}
            onViewLogs={handleViewLogs}
          />
        </>
      )}

      {/* MODAL — más grande, scroll horizontal en tabla */}
      {detailReason !== null && (
        <div style={s.modalOverlay} onClick={() => setDetailReason(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>
                  {lang === "es" ? "Registros de paro:" : "Downtime logs:"} {detailReason}
                </div>
                <div style={s.modalSub}>{range.start} → {range.end}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setDetailReason(null)}>✕</button>
            </div>

            {detailLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
                {lang === "es" ? "Cargando..." : "Loading..."}
              </div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {["Fecha", "Hrs", "Workcenter", "Status", "Turno", "Part No", "Op No", "Notas"].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "var(--color-bg)" }}>
                        <td style={s.td}>{row.Log_Date?.slice(0, 10)}</td>
                        <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: "#ef4444" }}>
                          {Number(row.Log_Hours).toFixed(2)}
                        </td>
                        <td style={s.td}>{row.Workcenter}</td>
                        <td style={s.td}>{row.Status}</td>
                        <td style={s.td}>{row.Shift ?? "—"}</td>
                        <td style={s.td}>{row.Part_No ?? "—"}</td>
                        <td style={s.td}>{row.Operation_No ?? "—"}</td>
                       
                        <td style={{ ...s.td, maxWidth: 220 }} title={row.Notes || ""}>
                          {row.Notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailRows.length === 0 && (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
                    {lang === "es" ? "Sin registros" : "No records"}
                  </div>
                )}
              </div>
            )}

            <div style={s.modalFooter}>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                {detailRows.length} {lang === "es" ? "registros" : "records"}
              </span>
              <button style={s.footerCloseBtn} onClick={() => setDetailReason(null)}>
                {lang === "es" ? "Cerrar" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:          { display: "flex", flexDirection: "column", gap: "1rem" },
  header:        { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" },
  title:         { fontSize: "1.375rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  subtitle:      { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  dateControls:  { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  fieldLabel:    { fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontWeight: 500 },
  dateInput:     { padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  errorBanner:   { padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" },
  loading:       { padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" },
  // Modal — más ancho y más alto
  modalOverlay:  { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" },
  modal:         { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl, 16px)", width: "100%", maxWidth: "1100px", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  modalHeader:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", flexShrink: 0 },
  modalTitle:    { fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" },
  modalSub:      { fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" },
  closeBtn:      { background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--color-text-secondary)", padding: "0.25rem", lineHeight: 1 },
  tableWrap:     { overflowX: "auto", overflowY: "auto", flex: 1 },
  table:         { width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", minWidth: 800 },
  th:            { padding: "0.625rem 0.875rem", textAlign: "left", fontWeight: 600, color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap", background: "var(--color-bg)", position: "sticky", top: 0 },
  td:            { padding: "0.5rem 0.875rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  modalFooter:   { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.875rem 1.5rem", borderTop: "1px solid var(--color-border)", flexShrink: 0 },
  footerCloseBtn:{ padding: "0.5rem 1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text-primary)", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 },
};