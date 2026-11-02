import { useState } from "react";
import apiClient from "../../../services/api.client";

type Requirement = {
  Operation_Number: number;
  Section_ID: number;
  Inspection_Type: string;
  Responsible_Department: string;
  Recorded_Checksheets: number;
  Last_Inspection_Date: string | null;
  Evaluation: string;
  Timer_Diagnostic: {
    state: string;
    reason?: string;
    due_at?: string;
    minutes_to_due?: number;
  };
};
type Diagnostic = {
  requirements: Requirement[];
  evidence_rows_scanned: number;
  evidence_truncated: boolean;
  latest_visible_inspection_date: string | null;
  pending_status_verified: boolean;
  teams_notifications_enabled: boolean;
  requirements_returned: number;
  workcenter_context?: {
    latest_observed_job_op_key: number | null;
    latest_observed_part_key: number | null;
    latest_event_date: string | null;
    is_current_state_verified: boolean;
  };
  warnings: string[];
};
type Observation = "ORANGE" | "GREEN" | "NOT_APPLICABLE" | "UNKNOWN";
const initial = {
  workcenter_key: "61104",
  part_key: "4553106",
  control_plan_key: "475605",
  job_op_key: "",
  operation_job_op_keys: "345:189332745,350:189332746,355:189332747",
  operation_numbers: "345,350,355",
  window_start: "",
  window_end: "",
  timer_anchor: "",
  evaluation_at: "",
};

function integer(value: string): number | null {
  const n = Number(value);
  return value.trim() && Number.isSafeInteger(n) && n > 0 ? n : null;
}
function displayStamp(value?: string | null) {
  return value ? value.replace("T", " ").slice(0, 19) : "—";
}

export default function ChecksheetsValidationPage() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<Diagnostic | null>(null);
  const [queriedContext, setQueriedContext] = useState<typeof initial | null>(null);
  const [observations, setObservations] = useState<Record<string, Observation>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operations = form.operation_numbers.split(",").map(s => s.trim()).filter(Boolean).map(Number);
  const mappingEntries = form.operation_job_op_keys.split(",").map(s => s.trim()).filter(Boolean);
  const mappingPairs = mappingEntries.map(entry => entry.split(":").map(Number));
  const mappingValid = mappingPairs.every(pair => pair.length === 2 &&
    pair.every(value => Number.isSafeInteger(value) && value > 0));
  const operationJobKeys = Object.fromEntries(mappingPairs.map(([op, job]) => [String(op), job]));
  const setField = (key: keyof typeof initial, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setResult(null);
    setQueriedContext(null);
    setObservations({});
  };

  async function load() {
    const wc = integer(form.workcenter_key);
    const part = integer(form.part_key);
    const plan = integer(form.control_plan_key);
    const job = integer(form.job_op_key);
    if (!wc || !part || !plan || (form.job_op_key && !job) ||
      operations.length > 30 || operations.some(n => !Number.isSafeInteger(n) || n <= 0) ||
      !mappingValid || (job !== null && mappingPairs.length > 0) ||
      (mappingPairs.length > 0 && operations.some(op => !Object.hasOwn(operationJobKeys, String(op))))) {
      setError("Revisa los identificadores y las operaciones.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setQueriedContext(null);
    setObservations({});
    try {
      const payload = {
        workcenter_key: wc,
        part_key: part,
        control_plan_key: plan,
        job_op_key: job,
        operation_job_op_keys: mappingPairs.length ? operationJobKeys : undefined,
        operation_numbers: operations.length ? operations : undefined,
        window_start: form.window_start || undefined,
        window_end: form.window_end || undefined,
        timer_anchor: form.timer_anchor || undefined,
        evaluation_at: form.evaluation_at || undefined,
      };
      const response = await apiClient.post<{data: Diagnostic}>("/production/checksheets/diagnostic/", payload);
      setResult(response.data.data);
      setQueriedContext({ ...form });
    } catch (err: unknown) {
      setError("No fue posible consultar el diagnóstico. Verifica fechas, conexión y permisos.");
    } finally {
      setBusy(false);
    }
  }

  const evidenceDate = result?.latest_visible_inspection_date
    ? new Date(result.latest_visible_inspection_date) : null;
  const evaluationDate = queriedContext?.evaluation_at ? new Date(queriedContext.evaluation_at) : null;
  const evidenceAgeHours = evidenceDate && evaluationDate
    ? (evaluationDate.getTime() - evidenceDate.getTime()) / 3600000 : null;
  const outdatedEvidence = evidenceAgeHours !== null && evidenceAgeHours > 24;
  const windowMismatch = Boolean(queriedContext?.evaluation_at && queriedContext?.window_end &&
    queriedContext.evaluation_at > queriedContext.window_end);
  const mismatchJob = Boolean(result?.workcenter_context?.latest_observed_job_op_key &&
    queriedContext?.job_op_key &&
    String(result.workcenter_context.latest_observed_job_op_key) !== queriedContext.job_op_key);
  const predictedObservation = (prediction: string): Observation | null => {
    if (prediction === "PREDICTED_PENDING") return "ORANGE";
    if (prediction === "PREDICTED_WITHIN_WINDOW") return "GREEN";
    if (prediction === "NOT_REQUIRED") return "NOT_APPLICABLE";
    return null;
  };
  const comparable = result?.requirements.filter(r => {
    const observed = observations[String(r.Section_ID)] || "UNKNOWN";
    return observed !== "UNKNOWN" && predictedObservation(r.Timer_Diagnostic.state) !== null;
  }) || [];
  const matches = comparable.filter(r =>
    predictedObservation(r.Timer_Diagnostic.state) === observations[String(r.Section_ID)]).length;

  const inputStyle: React.CSSProperties = {
    width: "100%", minWidth: 0, padding: "9px 10px", borderRadius: 8,
    border: "1px solid var(--color-border)", color: "var(--color-text-primary)",
    background: "var(--color-bg-primary)", boxSizing: "border-box",
  };
  const cardStyle: React.CSSProperties = {
    padding: 16, border: "1px solid var(--color-border)", borderRadius: 12,
    background: "var(--color-bg-primary)",
  };
  const fields: {key: keyof typeof initial; label: string; type?: string}[] = [
    {key: "workcenter_key", label: "Workcenter"},
    {key: "part_key", label: "Part Key"},
    {key: "control_plan_key", label: "Control Plan"},
    {key: "job_op_key", label: "Job Op Key (alternativa a mapeo)"},
    {key: "operation_job_op_keys", label: "Operación:Job Op (separados por comas)"},
    {key: "operation_numbers", label: "Operaciones (separadas por coma)"},
    {key: "window_start", label: "Inicio de ventana", type: "datetime-local"},
    {key: "window_end", label: "Fin de ventana", type: "datetime-local"},
    {key: "timer_anchor", label: "Inicio hipotético del temporizador", type: "datetime-local"},
    {key: "evaluation_at", label: "Evaluar temporizador en", type: "datetime-local"},
  ];

  return (
    <div style={{padding: 24, color: "var(--color-text-primary)", maxWidth: 1450, margin: "0 auto"}}>
      <h1 style={{fontSize: 26, marginBottom: 6}}>Production Checksheets — Validación</h1>
      <p style={{color: "var(--color-text-secondary)", marginBottom: 20}}>
        Diagnóstico experimental de solo lectura. Las tarjetas calculadas NO representan el estado oficial de Plex.
        Teams permanece desactivado.
      </p>
      <section style={cardStyle}>
        <h2 style={{fontSize: 18}}>Contexto de consulta</h2>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12}}>
          {fields.map(field => <label key={field.key} style={{display: "grid", gap: 5, fontSize: 13}}>
            <span>{field.label}</span>
            <input type={field.type || "text"} style={inputStyle}
              value={form[field.key]} onChange={e => setField(field.key, e.target.value)} />
          </label>)}
        </div>
        <button onClick={load} disabled={busy} style={{marginTop: 15, padding: "10px 18px", cursor: "pointer"}}>
          {busy ? "Consultando..." : "Consultar Plex"}
        </button>
        {error && <p role="alert" style={{color: "#c44343"}}>{error}</p>}
      </section>

      {result && <>
        {(outdatedEvidence || windowMismatch || mismatchJob || result.evidence_truncated) && (
          <section role="status" style={{...cardStyle, marginTop: 16, borderLeft: "4px solid #d48a20"}}>
            <strong>Precaución: esta consulta no confirma el estado actual de Plex.</strong>
            {outdatedEvidence && <p>La última evidencia visible es anterior a la evaluación por más de 24 horas.
              Puede existir retraso de sincronización o no haber registros recientes para el alcance consultado.</p>}
            {windowMismatch && <p>La hora de evaluación queda después del fin de la ventana de evidencia.</p>}
            {mismatchJob && <p>El último Job histórico del Workcenter no coincide con el Job seleccionado.
              Ninguno confirma el Job actualmente activo.</p>}
            {result.evidence_truncated && <p>Se alcanzó el límite de evidencias; los conteos pueden ser incompletos.</p>}
          </section>
        )}
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 16}}>
          <div style={cardStyle}><small>Requisitos</small><h2>{result.requirements_returned}</h2></div>
          <div style={cardStyle}><small>Evidencias examinadas (modelo y plan)</small><h2>{result.evidence_rows_scanned}</h2></div>
          <div style={cardStyle}><small>Última evidencia visible</small><div>{displayStamp(result.latest_visible_inspection_date)}</div></div>
          <div style={cardStyle}><small>Estado Plex confirmado</small><h2>No</h2></div>
        </div>
        <section style={{...cardStyle, marginTop: 16}}>
          <h2 style={{fontSize: 18}}>Comparación manual con Plex</h2>
          <p style={{fontSize: 13, color: "var(--color-text-secondary)"}}>
            Selecciona lo que observas en Plex por sección. Estas selecciones solo existen durante esta sesión de pantalla;
            no se guardan en el servidor.
          </p>
          <div style={{overflowX: "auto"}}>
            <table style={{width: "100%", borderCollapse: "collapse", minWidth: 950, textAlign: "left"}}>
              <thead><tr>{["Op.", "Sección", "Inspección", "Responsable", "Registros", "Último registro", "Predicción", "Próximo vencimiento", "Plex observado"].map(t =>
                <th key={t} style={{padding: 10, borderBottom: "1px solid var(--color-border)"}}>{t}</th>)}</tr></thead>
              <tbody>{result.requirements.map(r => {
                const key = String(r.Section_ID);
                const observed = observations[key] || "UNKNOWN";
                const predicted = r.Timer_Diagnostic.state;
                return <tr key={key} style={{borderBottom: "1px solid var(--color-border)"}}>
                  <td style={{padding: 10}}>{r.Operation_Number}</td>
                  <td>{r.Section_ID}</td><td>{r.Inspection_Type}</td><td>{r.Responsible_Department || "—"}</td>
                  <td>{r.Recorded_Checksheets}</td><td>{displayStamp(r.Last_Inspection_Date)}</td>
                  <td title={r.Timer_Diagnostic.reason}>{predicted}</td>
                  <td>{displayStamp(r.Timer_Diagnostic.due_at)}</td>
                  <td><select aria-label={`Estado de Plex para sección ${key}`} value={observed}
                    onChange={e => setObservations(prev => ({...prev, [key]: e.target.value as Observation}))}
                    style={inputStyle}>
                    <option value="UNKNOWN">Sin comparar</option>
                    <option value="GREEN">Verde</option>
                    <option value="ORANGE">Naranja</option>
                    <option value="NOT_APPLICABLE">No aplica</option>
                  </select></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <p style={{fontSize: 13, marginTop: 15}}>
            Observaciones capturadas: {Object.values(observations).filter(v => v !== "UNKNOWN").length}.
            Comparables con una predicción: {comparable.length}. Coincidencias: {matches}.
            Las reglas UNVERIFIED no cuentan como aciertos ni errores.
            No se emiten alertas ni se registran falsos pendientes.
          </p>
        </section>
        {result.warnings?.length > 0 && <section style={{...cardStyle, marginTop: 16}}>
          <h3>Limitaciones del diagnóstico</h3>
          <ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
        </section>}
      </>}
    </div>
  );
}
