import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { attendanceApi, type Employee } from "../api/attendanceApi";

export function OvertimeForm() {
  const [selectedEmployee, setSelectedEmployee] = useState<number | "">("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["attendance-employees"],
    queryFn: () => attendanceApi.getEmployees(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setLoading(true);
    setResult(null);
    try {
      await attendanceApi.registerOvertime(Number(selectedEmployee), date);
      setResult({ type: "success", message: "Horas extras registradas: 8 horas." });
      setSelectedEmployee("");
    } catch (err: any) {
      setResult({ type: "error", message: err?.response?.data?.error || "Error al registrar." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "#fff",
      borderRadius: 10,
      padding: "20px 24px",
      boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
    }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#333" }}>
        Registrar Horas Extras
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888" }}>
        Las horas extras siempre se registran como <strong>8 horas</strong>.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>
            Empleado
          </label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value ? Number(e.target.value) : "")}
            required
            style={selectStyle}
          >
            <option value="">Seleccionar empleado...</option>
            {(employees || []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.barcode_id}) — Turno {emp.turno}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={selectStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !selectedEmployee}
          style={{
            background: loading || !selectedEmployee ? "#ccc" : "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || !selectedEmployee ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Registrando..." : "Registrar 8h extras"}
        </button>
      </form>

      {result && (
        <div style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 8,
          background: result.type === "success" ? "#f0fdf4" : "#fff5f5",
          border: `1px solid ${result.type === "success" ? "#86efac" : "#fca5a5"}`,
          fontSize: 13,
          color: result.type === "success" ? "#166534" : "#991b1b",
          fontWeight: 600,
        }}>
          {result.type === "success" ? "✅ " : "❌ "}{result.message}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  minWidth: 280,
};
