import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AssistanceService } from "./assistance.service";

type Mode = "checkin" | "checkout";

interface ScanResult {
  type: "success" | "error";
  message: string;
  employee?: string;
  turno?: string;
  time?: string;
  check_in?: string | null;
  check_out?: string | null;
  regular_hours?: number | null;
  overtime_hours?: number | null;
}

interface Props {
  lang: "es" | "en";
}

export function CheckInTab({ lang }: Props) {
  const [mode, setMode]       = useState<Mode>("checkin");
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ScanResult | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  // Overtime state
  const [showOT, setShowOT]       = useState(false);
  const [otEmployee, setOtEmployee] = useState<number | "">("");
  const [otDate, setOtDate]       = useState(new Date().toISOString().slice(0, 10));
  const [otLoading, setOtLoading] = useState(false);
  const [otMsg, setOtMsg]         = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["ccs-employees"],
    queryFn:  () => AssistanceService.getCcsEmployees(),
  });

  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    setLoading(true);
    try {
      const res = mode === "checkin"
        ? await AssistanceService.checkIn(barcode.trim())
        : await AssistanceService.checkOut(barcode.trim());

      if (res.success) {
        const d = res.data || {};
        setResult({
          type:          "success",
          message:       mode === "checkin"
            ? (lang === "es" ? "Entrada registrada" : "Check-in recorded")
            : (lang === "es" ? "Salida registrada" : "Check-out recorded"),
          employee:      d.employee_name,
          turno:         d.turno,
          time:          new Date().toLocaleTimeString("es-MX"),
          regular_hours: d.regular_hours,
          overtime_hours: d.overtime_hours,
        });
      } else {
        setResult({ type: "error", message: res.error || "Error desconocido" });
      }
    } catch (err: any) {
      setResult({ type: "error", message: err?.response?.data?.detail || "Error al registrar." });
    } finally {
      setLoading(false);
      setBarcode("");
      inputRef.current?.focus();
    }
  };

  const handleOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otEmployee) return;
    setOtLoading(true); setOtMsg(null);
    try {
      const res = await AssistanceService.registerOvertime(Number(otEmployee), otDate);
      if (res.success) {
        setOtMsg({ type: "success", text: lang === "es" ? "8 horas extras registradas." : "8 overtime hours recorded." });
        setOtEmployee("");
      } else {
        setOtMsg({ type: "error", text: res.error || "Error" });
      }
    } catch (err: any) {
      setOtMsg({ type: "error", text: err?.response?.data?.detail || "Error al registrar." });
    } finally {
      setOtLoading(false);
    }
  };

  const modeColor = mode === "checkin" ? "#00B050" : "#0070C0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 560 }}>
      {/* Mode toggle */}
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-border)" }}>
        {(["checkin", "checkout"] as Mode[]).map((m) => (
          <button key={m} onClick={() => { setMode(m); setResult(null); }} style={{
            flex: 1, padding: "10px 0", border: "none",
            background: mode === m ? (m === "checkin" ? "#00B050" : "#0070C0") : "var(--color-surface)",
            color: mode === m ? "#fff" : "var(--color-text-secondary)",
            fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
          }}>
            {m === "checkin"
              ? (lang === "es" ? "✅ Entrada" : "✅ Check-In")
              : (lang === "es" ? "🚪 Salida" : "🚪 Check-Out")}
          </button>
        ))}
      </div>

      {/* Barcode form */}
      <form onSubmit={handleScan} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
          {lang === "es" ? "Escanea o ingresa el código de barras" : "Scan or enter barcode"}
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
            border: `2px solid ${modeColor}`,
            borderRadius: 8, padding: "12px 16px",
            fontSize: 20, textAlign: "center", letterSpacing: 2,
            background: "var(--color-surface)", color: "var(--color-text-primary)",
            outline: "none",
          }}
        />
        <button type="submit" disabled={loading || !barcode.trim()} style={{
          background: loading || !barcode.trim() ? "var(--color-border)" : modeColor,
          color: "#fff", border: "none", borderRadius: 8,
          padding: "12px 0", fontSize: "0.9375rem", fontWeight: 700,
          cursor: loading || !barcode.trim() ? "not-allowed" : "pointer",
        }}>
          {loading
            ? (lang === "es" ? "Registrando..." : "Recording...")
            : mode === "checkin"
              ? (lang === "es" ? "Registrar Entrada" : "Record Check-In")
              : (lang === "es" ? "Registrar Salida" : "Record Check-Out")}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div style={{
          padding: "1rem 1.25rem", borderRadius: 8,
          background: result.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.08)",
          border: `1px solid ${result.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(220,38,38,0.3)"}`,
        }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem",
            color: result.type === "success" ? "#10b981" : "#ef4444" }}>
            {result.type === "success" ? "✅ " : "❌ "}{result.message}
          </p>
          {result.employee && (
            <p style={{ margin: "6px 0 0", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
              <strong>{result.employee}</strong>
              {result.turno && <> · Turno <strong>{result.turno}</strong></>}
              {result.time && <> · {result.time}</>}
              {result.regular_hours != null && (
                <> · {lang === "es" ? "Horas reg.:" : "Reg. hours:"} <strong>{result.regular_hours}h</strong></>
              )}
            </p>
          )}
        </div>
      )}

      {/* Overtime section */}
      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
        <button onClick={() => setShowOT((p) => !p)} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: "0.875rem", fontWeight: 600,
          color: "#6366f1", textDecoration: "underline",
          padding: 0,
        }}>
          {showOT
            ? (lang === "es" ? "▲ Ocultar Horas Extras" : "▲ Hide Overtime")
            : (lang === "es" ? "▼ Registrar Horas Extras" : "▼ Register Overtime")}
        </button>

        {showOT && (
          <form onSubmit={handleOvertime} style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                {lang === "es" ? "Empleado" : "Employee"}
              </label>
              <select value={otEmployee} onChange={(e) => setOtEmployee(e.target.value ? Number(e.target.value) : "")}
                required style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "7px 10px", fontSize: "0.875rem", background: "var(--color-surface)", color: "var(--color-text-primary)", minWidth: 240 }}>
                <option value="">{lang === "es" ? "Seleccionar..." : "Select..."}</option>
                {(employees || []).map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.barcode_id}) — T{e.turno}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                {lang === "es" ? "Fecha" : "Date"}
              </label>
              <input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} required
                style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "7px 10px", fontSize: "0.875rem", background: "var(--color-surface)", color: "var(--color-text-primary)" }} />
            </div>
            <button type="submit" disabled={otLoading || !otEmployee} style={{
              background: otLoading || !otEmployee ? "var(--color-border)" : "#6366f1",
              color: "#fff", border: "none", borderRadius: 6,
              padding: "8px 16px", fontSize: "0.875rem", fontWeight: 600,
              cursor: otLoading || !otEmployee ? "not-allowed" : "pointer",
            }}>
              {otLoading
                ? (lang === "es" ? "Registrando..." : "Recording...")
                : (lang === "es" ? "Registrar 8h extras" : "Record 8h overtime")}
            </button>
            {otMsg && (
              <p style={{ width: "100%", margin: 0, fontSize: "0.8125rem", fontWeight: 600,
                color: otMsg.type === "success" ? "#10b981" : "#ef4444" }}>
                {otMsg.type === "success" ? "✅ " : "❌ "}{otMsg.text}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
