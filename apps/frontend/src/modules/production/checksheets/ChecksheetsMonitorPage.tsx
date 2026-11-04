import { useEffect, useState } from "react";
import apiClient from "../../../services/api.client";

type Group = {
  group_key: string;
  group_name: string;
  department: string;
  status: string;
  historical_sequence_state: string;
  complete_historical_cycles: number;
  last_historical_completion_at: string | null;
  next_expected_section_from_history: number | null;
  evidence_truncated: boolean;
  evidence_rows_scanned: number;
  blocking_reasons: string[];
};
type Department = { department: string; status: string; groups: Group[] };
type WC = {
  workcenter_key: number;
  workcenter_name: string;
  part_key: number;
  part_no_rev: string;
  control_plan_key: number;
  configuration_scope: string;
  status: string;
  department_results: Department[];
  departments_not_evaluated: string[];
};
type Area = { area_key: string; area_name: string; workcenters: WC[] };
type Monitor = {
  areas: Area[];
  workcenters_returned: number;
  current_plex_status_verified: boolean;
  teams_notifications_enabled: boolean;
};
type CatalogWC = {
  area_key: string;
  area_name: string;
  workcenter_key: number;
  workcenter_name: string;
  part_no_rev: string;
};

export default function ChecksheetsMonitorPage() {
  const [area, setArea] = useState("ALL");
  const [catalog, setCatalog] = useState<CatalogWC[]>([]);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [observedTime, setObservedTime] = useState("");
  const [freshness, setFreshness] = useState<{
    state: string; reason: string; observed_capture_at?: string;
    latest_odbc_capture_at?: string | null;
  } | null>(null);
  const [freshnessLoading, setFreshnessLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get<{data: CatalogWC[]}>("/production/checksheets/monitor/")
      .then(res => setCatalog(res.data.data))
      .catch(() => setError("No fue posible cargar el catálogo de Workcenters."));
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.post<{data: Monitor}>(
        "/production/checksheets/monitor/", {}
      );
      setMonitor(res.data.data);
    } catch {
      setError("No fue posible consultar Plex. Se conservó la última respuesta visible.");
    } finally {
      setLoading(false);
    }
  }

  async function compareCapture() {
    if (!observedTime) {
      setError("Indica la fecha y hora observada en Plex.");
      return;
    }
    setFreshnessLoading(true);
    setError("");
    setFreshness(null);
    try {
      const res = await apiClient.post<{data: {freshness: NonNullable<typeof freshness>}}>(
        "/production/checksheets/freshness/",
        {
          workcenter_key: 75408,
          section_id: 2345917,
          observed_capture_at: observedTime,
        }
      );
      setFreshness(res.data.data.freshness);
    } catch {
      setError("No se pudo comparar la captura con ODBC.");
    } finally {
      setFreshnessLoading(false);
    }
  }

  const filtered = (monitor?.areas || []).filter(a => area === "ALL" || a.area_key === area);
  const cardStyle: React.CSSProperties = {
    padding: 18, border: "1px solid var(--color-border)", borderRadius: 12,
    background: "var(--color-bg-primary)",
  };

  return <main style={{padding: 24, maxWidth: 1320, margin: "0 auto", color: "var(--color-text-primary)"}}>
    <h1>Production Checksheets Monitor</h1>
    <p style={{color: "var(--color-text-secondary)"}}>
      Monitor experimental de solo lectura. Los ciclos históricos no prueban el estado
      actual de Plex. Sin alertas de Teams.
    </p>
    <div style={{display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 18}}>
      <label htmlFor="checksheet-area">Área</label>
      <select id="checksheet-area" value={area} onChange={e => setArea(e.target.value)}
        style={{padding: 8, minWidth: 180}}>
        <option value="ALL">Todas las áreas</option>
        {Array.from(new Map(catalog.map(w => [w.area_key, w.area_name])).entries())
          .map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
      <button type="button" onClick={refresh} disabled={loading}
        style={{padding: "9px 18px", cursor: "pointer"}}>
        {loading ? "Consultando Plex..." : "Actualizar diagnóstico"}
      </button>
      <a href="/production/checksheets-validation">Validación detallada</a>
    </div>
    <section style={{...cardStyle, marginBottom: 18}}>
      <h2 style={{marginTop: 0, fontSize: 18}}>Validación de frescura — piloto WC 75408</h2>
      <p>Compara la última captura observada en Plex de la sección 2345917
        (Op. 895, inspección de 120 min) con la última disponible en ODBC.
        La comparación es manual y no confirma cumplimiento ni genera alertas.</p>
      <label htmlFor="observed-plex-time">Fecha y hora de captura en Plex (hora local)</label>
      <div style={{display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8}}>
        <input id="observed-plex-time" type="datetime-local" step="1"
          value={observedTime} onChange={e => {setObservedTime(e.target.value); setFreshness(null);}}
          style={{padding: 8}} />
        <button type="button" disabled={freshnessLoading} onClick={compareCapture}
          style={{padding: "9px 18px"}}>
          {freshnessLoading ? "Comparando..." : "Comparar captura con ODBC"}
        </button>
      </div>
      {freshness && <div role="status" style={{marginTop: 12}}>
        <p><strong>Frescura respecto de la observación:</strong> {freshness.state}</p>
        <p>Referencia Plex: {freshness.observed_capture_at || "—"}</p>
        <p>Última captura ODBC: {freshness.latest_odbc_capture_at || "No encontrada"}</p>
        <small>La evaluación es por sección, no por Workcenter completo. Estado de cumplimiento: UNVERIFIED.</small>
      </div>}
    </section>
    {error && <p role="alert">{error}</p>}
    {!monitor && <section style={cardStyle}>
      <strong>Catálogo piloto</strong>
      <p>Workcenters configurados: {catalog.filter(w => area === "ALL" || w.area_key === area).length}.
        Selecciona «Actualizar diagnóstico» para consultar evidencia histórica.</p>
      {catalog.filter(w => area === "ALL" || w.area_key === area)
        .map(w => <p key={w.workcenter_key}>{w.area_name} — {w.workcenter_name} (WC {w.workcenter_key}) · {w.part_no_rev}</p>)}
    </section>}
    {monitor && <section aria-label="Resumen de monitoreo">
      <p><strong>{monitor.workcenters_returned} WC configurado(s)</strong> ·
        Estado actual verificado: {monitor.current_plex_status_verified ? "Sí" : "No"} ·
        Teams: {monitor.teams_notifications_enabled ? "Activo" : "Desactivado"}</p>
      {filtered.map(a => <section key={a.area_key} style={{marginTop: 24}}>
        <h2>{a.area_name}</h2>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16}}>
          {a.workcenters.map(w => <article key={w.workcenter_key} style={cardStyle}>
            <h3 style={{marginTop: 0}}>{w.workcenter_name}</h3>
            <p>WC {w.workcenter_key} · {w.part_no_rev}</p>
            <p><strong>Estado general: {w.status}</strong></p>
            {w.department_results.map(d => <section key={d.department}
              style={{borderTop: "1px solid var(--color-border)", paddingTop: 10}}>
              <h4 style={{marginBottom: 6}}>{d.department === "PRODUCTION" ? "Producción" : d.department === "QUALITY" ? "Calidad" : d.department}</h4>
              <p>Estado: <strong>{d.status}</strong></p>
              {d.groups.map(g => <div key={g.group_key}>
                <p>{g.group_name}</p>
                <p>Ciclos históricos completos: {g.complete_historical_cycles}</p>
                <p>Último cierre histórico: {g.last_historical_completion_at?.replace("T", " ") || "No observado"}</p>
                <p>Último intento: {g.historical_sequence_state}</p>
                {g.evidence_truncated && <p>Advertencia: evidencia truncada.</p>}
              </div>)}
            </section>)}
            {w.departments_not_evaluated.length > 0 &&
              <p>Departamentos sin evaluar: {w.departments_not_evaluated.join(", ")}</p>}
            <small>Configuración piloto, no validación del Job ni del turno actual.</small>
          </article>)}
        </div>
      </section>)}
    </section>}
  </main>;
}
