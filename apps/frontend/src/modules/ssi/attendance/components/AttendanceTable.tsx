import type { PaginatedAttendance, AttendanceRecord } from "../api/attendanceApi";

interface Props {
  data: PaginatedAttendance | undefined;
  loading: boolean;
  page: number;
  onPageChange: (p: number) => void;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Presente: { bg: "#f0fdf4", color: "#166534" },
  Retardo: { bg: "#fffbeb", color: "#92400e" },
  Ausente: { bg: "#fff5f5", color: "#991b1b" },
  Falta: { bg: "#fff5f5", color: "#991b1b" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || { bg: "#f5f5f5", color: "#555" };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
    }}>
      {status}
    </span>
  );
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function fmtH(h: number | null | undefined): string {
  if (h == null) return "-";
  return `${h}h`;
}

export function AttendanceTable({ data, loading, page, onPageChange }: Props) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: "#333" }}>
        Registros de asistencia
        {data && <span style={{ color: "#888", fontWeight: 400, marginLeft: 8 }}>({data.total} total)</span>}
      </h3>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f7f9fc" }}>
              {["Fecha", "Empleado", "Código", "Turno", "Entrada", "Salida",
                "H. Regulares", "H. Extras", "Total h.", "Estado"].map((h) => (
                <th key={h} style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "#555",
                  borderBottom: "2px solid #eee",
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} style={{ padding: "10px 12px" }}>
                        <div style={{ height: 14, background: "#f0f0f0", borderRadius: 4 }} />
                      </td>
                    ))}
                  </tr>
                ))
              : !data?.results.length
              ? (
                <tr>
                  <td colSpan={10} style={{ padding: 30, textAlign: "center", color: "#aaa" }}>
                    Sin registros
                  </td>
                </tr>
              )
              : data.results.map((row: AttendanceRecord, i) => (
                <tr key={row.attendance_id} style={{
                  borderBottom: "1px solid #f0f0f0",
                  background: i % 2 === 0 ? "#fff" : "#fafafa",
                }}>
                  <td style={td}>{row.attendance_date}</td>
                  <td style={td}>{row.employee_name}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{row.barcode_id}</td>
                  <td style={td}>
                    <span style={{
                      background: row.turno === "A" ? "#e8f4fd" : "#e8fdf0",
                      color: row.turno === "A" ? "#0070C0" : "#00B050",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {row.turno}
                    </span>
                  </td>
                  <td style={td}>{fmt(row.check_in)}</td>
                  <td style={td}>{fmt(row.check_out)}</td>
                  <td style={td}>{fmtH(row.regular_hours)}</td>
                  <td style={{ ...td, color: row.overtime_hours ? "#6366f1" : "#ccc" }}>
                    {row.overtime_hours ? `${row.overtime_hours}h` : "-"}
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{fmtH(row.total_hours)}</td>
                  <td style={td}><StatusBadge status={row.status} /></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={paginBtn}>
            ‹ Anterior
          </button>
          <span style={{ fontSize: 13, color: "#555" }}>
            Página {page} de {data.pages}
          </span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= data.pages} style={paginBtn}>
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}

const td: React.CSSProperties = { padding: "9px 12px", whiteSpace: "nowrap" };
const paginBtn: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 6,
  padding: "6px 14px",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};
