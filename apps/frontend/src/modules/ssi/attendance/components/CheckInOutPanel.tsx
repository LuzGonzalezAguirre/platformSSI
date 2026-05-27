import { useState, useRef, useEffect } from "react";
import { attendanceApi, type CheckInResponse } from "../api/attendanceApi";

type Mode = "checkin" | "checkout";

interface LastResult {
  type: "success" | "error";
  message: string;
  employee?: string;
  turno?: string;
  time?: string;
}

export function CheckInOutPanel() {
  const [mode, setMode] = useState<Mode>("checkin");
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<LastResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    setLoading(true);
    try {
      const res: CheckInResponse =
        mode === "checkin"
          ? await attendanceApi.checkIn(barcode.trim())
          : await attendanceApi.checkOut(barcode.trim());

      setLast({
        type: "success",
        message: res.message || (mode === "checkin" ? "Check-in registrado" : "Check-out registrado"),
        employee: res.employee?.name,
        turno: res.turno || res.employee?.turno,
        time: new Date().toLocaleTimeString("es-MX"),
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Error al registrar.";
      setLast({ type: "error", message: msg });
    } finally {
      setLoading(false);
      setBarcode("");
      inputRef.current?.focus();
    }
  };

  const modeColor = mode === "checkin" ? "#00B050" : "#0070C0";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 28,
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#1a1a2e", textAlign: "center" }}>
        Registro de Asistencia
      </h2>

      {/* Mode toggle */}
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", marginBottom: 24, border: "1px solid #e0e0e0" }}>
        {(["checkin", "checkout"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setLast(null); }}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              background: mode === m ? modeColor : "#f9f9f9",
              color: mode === m ? "#fff" : "#555",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {m === "checkin" ? "✅ Entrada" : "🚪 Salida"}
          </button>
        ))}
      </div>

      {/* Barcode input */}
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>
          Escanea o ingresa el código de barras
        </label>
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="9000XXXXA"
          disabled={loading}
          autoComplete="off"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: `2px solid ${modeColor}`,
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 18,
            textAlign: "center",
            letterSpacing: 2,
            outline: "none",
            marginBottom: 16,
          }}
        />
        <button
          type="submit"
          disabled={loading || !barcode.trim()}
          style={{
            width: "100%",
            background: loading || !barcode.trim() ? "#ccc" : modeColor,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "12px 0",
            fontSize: 15,
            fontWeight: 700,
            cursor: loading || !barcode.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Registrando..." : mode === "checkin" ? "Registrar Entrada" : "Registrar Salida"}
        </button>
      </form>

      {/* Result feedback */}
      {last && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 8,
            background: last.type === "success" ? "#f0fdf4" : "#fff5f5",
            border: `1px solid ${last.type === "success" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: last.type === "success" ? "#166534" : "#991b1b" }}>
            {last.type === "success" ? "✅ " : "❌ "}
            {last.message}
          </p>
          {last.employee && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#444" }}>
              Empleado: <strong>{last.employee}</strong>
              {last.turno && <> · Turno <strong>{last.turno}</strong></>}
              {last.time && <> · <span style={{ color: "#888" }}>{last.time}</span></>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
