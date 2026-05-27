import { useState } from "react";
import type { BreakRecord, BreaksPaginatedResponse } from "../api/chairApi";

interface Props {
  data: BreaksPaginatedResponse | undefined;
  loading: boolean;
  page: number;
  search: string;
  orderBy: string;
  orderDir: "ASC" | "DESC";
  onPageChange: (p: number) => void;
  onSearchChange: (s: string) => void;
  onSort: (col: string) => void;
}

const COLUMNS: { key: keyof BreakRecord | string; label: string; sortable?: boolean }[] = [
  { key: "break_date", label: "Fecha", sortable: true },
  { key: "check_in", label: "Hora entrada", sortable: true },
  { key: "check_out", label: "Hora salida" },
  { key: "employee_name", label: "Empleado", sortable: true },
  { key: "barcode_id", label: "Código" },
  { key: "turno", label: "Turno" },
  { key: "chair_number", label: "Silla #", sortable: true },
  { key: "duration_min", label: "Duración (min)", sortable: true },
  { key: "released_by", label: "Liberado por" },
];

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function BreaksTable({
  data,
  loading,
  page,
  search,
  orderBy,
  orderDir,
  onPageChange,
  onSearchChange,
  onSort,
}: Props) {
  const [searchLocal, setSearchLocal] = useState(search);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSearchChange(searchLocal);
  };

  const cellValue = (row: BreakRecord, key: string): React.ReactNode => {
    switch (key) {
      case "check_in": return formatTime(row.check_in);
      case "check_out": return formatTime(row.check_out);
      case "released_by": {
        const color = row.released_by === "Auto" ? "#00B050" : row.released_by === "Manual" ? "#0070C0" : "#888";
        return <span style={{ color, fontWeight: 600 }}>{row.released_by}</span>;
      }
      case "turno": return (
        <span style={{
          background: row.turno === "A" ? "#e8f4fd" : "#e8fdf0",
          color: row.turno === "A" ? "#0070C0" : "#00B050",
          borderRadius: 4,
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 700,
        }}>{row.turno}</span>
      );
      default: return (row as any)[key] ?? "-";
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#333" }}>
          Registro de descansos
          {data && <span style={{ color: "#888", fontWeight: 400, marginLeft: 8 }}>({data.total} total)</span>}
        </h3>
        <input
          type="text"
          placeholder="Buscar por nombre o código..."
          value={searchLocal}
          onChange={(e) => setSearchLocal(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onBlur={() => onSearchChange(searchLocal)}
          style={{
            border: "1px solid #d0d5dd",
            borderRadius: 6,
            padding: "7px 12px",
            fontSize: 13,
            width: 240,
            outline: "none",
          }}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f7f9fc" }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => onSort(col.key) : undefined}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#555",
                    borderBottom: "2px solid #eee",
                    cursor: col.sortable ? "pointer" : "default",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  {col.label}
                  {col.sortable && orderBy === col.key && (
                    <span style={{ marginLeft: 4 }}>{orderDir === "ASC" ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => (
                    <td key={c.key} style={{ padding: "10px 12px" }}>
                      <div style={{ height: 14, background: "#f0f0f0", borderRadius: 4 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data?.results.length ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: 30, textAlign: "center", color: "#aaa" }}>
                  Sin registros
                </td>
              </tr>
            ) : (
              data.results.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                >
                  {COLUMNS.map((col) => (
                    <td key={col.key} style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      {cellValue(row, col.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={paginBtn}
          >
            ‹ Anterior
          </button>
          <span style={{ fontSize: 13, color: "#555" }}>
            Página {page} de {data.pages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= data.pages}
            style={paginBtn}
          >
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}

const paginBtn: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 6,
  padding: "6px 14px",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};
