import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { attendanceApi, type AttendanceFilters } from "../api/attendanceApi";
import { AttendanceKPIs } from "../components/AttendanceKPIs";
import { CheckInOutPanel } from "../components/CheckInOutPanel";
import { OvertimeForm } from "../components/OvertimeForm";
import { AttendanceTable } from "../components/AttendanceTable";

const today = new Date().toISOString().slice(0, 10);
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

const DEFAULT_FILTERS: AttendanceFilters = { start_date: sevenDaysAgo, end_date: today };

type Tab = "dashboard" | "checkin" | "overtime";

export default function AttendanceDashboard() {
  const [tab, setTab] = useState<Tab>("checkin");
  const [filters, setFilters] = useState<AttendanceFilters>(DEFAULT_FILTERS);
  const [localFilters, setLocalFilters] = useState<AttendanceFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey: ["attendance-kpis", filters],
    queryFn: () => attendanceApi.getKpis(filters),
    enabled: tab === "dashboard",
  });

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ["attendance-records", filters, page],
    queryFn: () => attendanceApi.getRecords({ ...filters, page, page_size: 20 }),
    enabled: tab === "dashboard",
  });

  const { data: departments } = useQuery({
    queryKey: ["attendance-departments"],
    queryFn: () => attendanceApi.getDepartments(),
  });

  const applyFilters = () => { setFilters(localFilters); setPage(1); };
  const clearFilters = () => {
    setLocalFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try { await attendanceApi.downloadPdf(filters); }
    catch { alert("Error al generar PDF."); }
    finally { setPdfLoading(false); }
  };

  const handleDownloadExcel = async () => {
    setExcelLoading(true);
    try { await attendanceApi.downloadExcel(filters); }
    catch { alert("Error al generar Excel."); }
    finally { setExcelLoading(false); }
  };

  return (
    <div style={{ padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
          Sistema de Asistencia — SSI Producción
        </h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
          Control de asistencia, horas regulares y extras por turno
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
        {(["checkin", "dashboard", "overtime"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            checkin: "📋 Check-in / Check-out",
            dashboard: "📊 Dashboard",
            overtime: "⏰ Horas Extras",
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 22px",
                border: "none",
                borderBottom: tab === t ? "2px solid #0070C0" : "2px solid transparent",
                background: "none",
                color: tab === t ? "#0070C0" : "#666",
                fontWeight: tab === t ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                marginBottom: -2,
              }}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* Tab: Check-in / Check-out */}
      {tab === "checkin" && (
        <div style={{ maxWidth: 540, margin: "0 auto", paddingTop: 20 }}>
          <CheckInOutPanel />
        </div>
      )}

      {/* Tab: Dashboard */}
      {tab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Filters */}
          <div style={{
            background: "#fff",
            borderRadius: 10,
            padding: "14px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
            boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
          }}>
            {[
              { label: "Inicio", key: "start_date", type: "date" },
              { label: "Fin", key: "end_date", type: "date" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>{label}</label>
                <input
                  type={type}
                  value={(localFilters as any)[key] || ""}
                  onChange={(e) => setLocalFilters({ ...localFilters, [key]: e.target.value })}
                  style={{ border: "1px solid #d0d5dd", borderRadius: 6, padding: "7px 10px", fontSize: 13, minWidth: 140 }}
                />
              </div>
            ))}

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>Turno</label>
              <select
                value={localFilters.turno || ""}
                onChange={(e) => setLocalFilters({ ...localFilters, turno: e.target.value || undefined })}
                style={{ border: "1px solid #d0d5dd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
              >
                <option value="">Todos</option>
                <option value="A">Turno A</option>
                <option value="B">Turno B</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>Departamento</label>
              <select
                value={localFilters.department || ""}
                onChange={(e) => setLocalFilters({ ...localFilters, department: e.target.value || undefined })}
                style={{ border: "1px solid #d0d5dd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
              >
                <option value="">Todos</option>
                {(departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={applyFilters} style={{ background: "#0070C0", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Aplicar
              </button>
              <button onClick={clearFilters} style={{ background: "#f0f0f0", color: "#333", border: "1px solid #d0d5dd", borderRadius: 6, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
                Limpiar
              </button>
              <button onClick={handleDownloadPdf} disabled={pdfLoading} style={{ background: pdfLoading ? "#ccc" : "#e74c3c", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: pdfLoading ? "not-allowed" : "pointer", fontWeight: 600 }}>
                {pdfLoading ? "..." : "⬇ PDF"}
              </button>
              <button onClick={handleDownloadExcel} disabled={excelLoading} style={{ background: excelLoading ? "#ccc" : "#00B050", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: excelLoading ? "not-allowed" : "pointer", fontWeight: 600 }}>
                {excelLoading ? "..." : "⬇ Excel"}
              </button>
            </div>
          </div>

          <AttendanceKPIs data={kpis} loading={kpiLoading} />
          <AttendanceTable data={records} loading={recordsLoading} page={page} onPageChange={setPage} />
        </div>
      )}

      {/* Tab: Overtime */}
      {tab === "overtime" && (
        <div style={{ maxWidth: 680 }}>
          <OvertimeForm />
        </div>
      )}
    </div>
  );
}
