import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck, AlertTriangle, Plus, X, ChevronDown,
} from "lucide-react";
import { SafetyService } from "./safety.service";
import {
  SafetySettings, SafetyIncident,
  SafetyIncidentCreatePayload, SafetyIncidentFilters,
  IncidentType, Severity, IncidentStatus,
  INCIDENT_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_COLORS,
  STATUS_LABELS, STATUS_COLORS, AREAS, ROOT_CAUSES,
} from "./types";

type Tab = "metrics" | "report" | "history";

export default function SafetyPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [activeTab, setActiveTab] = useState<Tab>("metrics");
  const [settings, setSettings]   = useState<SafetySettings | null>(null);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filters, setFilters]     = useState<SafetyIncidentFilters>({});

  const [form, setForm] = useState<Partial<SafetyIncidentCreatePayload>>({
    incident_date: new Date().toISOString().split("T")[0],
    incident_type: "near_miss",
    severity:      "low",
    area:          "",
    description:   "",
    immediate_actions: "",
    root_cause:    "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, i] = await Promise.all([
        SafetyService.getSettings(),
        SafetyService.listIncidents(filters),
      ]);
      setSettings(s);
      setIncidents(i);
    } catch {
      setError(lang === "es" ? "Error cargando datos de seguridad" : "Error loading safety data");
    } finally {
      setLoading(false);
    }
  }, [filters, lang]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdateLastIncident = async (date: string) => {
    try {
      const updated = await SafetyService.updateSettings(date || null);
      setSettings(updated);
    } catch {
      setError(lang === "es" ? "Error actualizando fecha" : "Error updating date");
    }
  };

  const handleStatusChange = async (incident: SafetyIncident, newStatus: IncidentStatus) => {
    try {
      const updated = await SafetyService.updateIncidentStatus(incident.id, newStatus);
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch {
      setError(lang === "es" ? "Error actualizando incidente" : "Error updating incident");
    }
  };

  const handleSubmitIncident = async () => {
    if (!form.description?.trim()) {
      setSubmitMsg({ type: "error", text: lang === "es" ? "La descripción es obligatoria" : "Description is required" });
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await SafetyService.createIncident(form as SafetyIncidentCreatePayload);
      setSubmitMsg({ type: "success", text: lang === "es" ? "Incidente reportado correctamente" : "Incident reported successfully" });
      setForm({
        incident_date: new Date().toISOString().split("T")[0],
        incident_type: "near_miss",
        severity:      "low",
        area:          "",
        description:   "",
        immediate_actions: "",
        root_cause:    "",
      });
      loadData();
    } catch {
      setSubmitMsg({ type: "error", text: lang === "es" ? "Error al reportar incidente" : "Error reporting incident" });
    } finally {
      setSubmitting(false);
    }
  };

  const thisYear = new Date().getFullYear().toString();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const yearIncidents  = incidents.filter((i) => i.incident_date.startsWith(thisYear));
  const openIncidents  = incidents.filter((i) => i.status === "open");
  const nearMissMonth  = incidents.filter((i) => i.incident_type === "near_miss" && i.incident_date.startsWith(thisMonth));

  const s = styles;

  const TABS: { key: Tab; label: { es: string; en: string } }[] = [
    { key: "metrics", label: { es: "Métricas",           en: "Safety Metrics"    } },
    { key: "report",  label: { es: "Reportar Incidente", en: "Report Incident"   } },
    { key: "history", label: { es: "Historial",          en: "Incident History"  } },
  ];

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.title}>{lang === "es" ? "Seguridad" : "Safety"}</h1>
          <p style={s.subtitle}>
            {lang === "es"
              ? "KPIs de seguridad y gestión de incidentes"
              : "Safety KPIs and incident management"}
          </p>
        </div>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {/* TABS */}
      <div style={s.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={{ ...s.tabBtn, ...(activeTab === tab.key ? s.tabBtnActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label[lang]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.loadingState}>{lang === "es" ? "Cargando..." : "Loading..."}</div>
      ) : (
        <>
          {/* ── METRICS TAB ── */}
          {activeTab === "metrics" && settings && (
            <div style={s.section}>
              {/* Days without incident hero */}
              <div style={s.heroCard}>
                <div style={s.heroIcon}><ShieldCheck size={40} color="#10b981" /></div>
                <div style={s.heroContent}>
                  <div style={s.heroDays}>{settings.days_without_incident}</div>
                  <div style={s.heroLabel}>
                    {lang === "es" ? "Días sin incidente" : "Days Without Incident"}
                  </div>
                  {settings.last_incident_date && (
                    <div style={s.heroSub}>
                      {lang === "es" ? "Último incidente:" : "Last incident:"} {settings.last_incident_date}
                    </div>
                  )}
                </div>
              </div>

              {/* Update last incident date */}
              <div style={s.updateRow}>
                <label style={s.fieldLabel}>
                  {lang === "es" ? "Fecha del último incidente:" : "Last incident date:"}
                </label>
                <input
                  type="date"
                  defaultValue={settings.last_incident_date ?? ""}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => handleUpdateLastIncident(e.target.value)}
                  style={s.dateInput}
                />
              </div>

              {/* KPI grid */}
              <div style={s.kpiGrid}>
                <div style={s.kpiCard}>
                  <div style={s.kpiValue}>{yearIncidents.length}</div>
                  <div style={s.kpiLabel}>
                    {lang === "es" ? "Incidentes en el año" : "Year-to-Date Incidents"}
                  </div>
                  
                </div>
                <div style={s.kpiCard}>
                  <div style={s.kpiValue}>{openIncidents.length}</div>
                  <div style={s.kpiLabel}>
                    {lang === "es" ? "Incidentes abiertos" : "Open Incidents"}
                  </div>
                  <div style={s.kpiSub}>{lang === "es" ? "Requieren atención" : "Require attention"}</div>
                </div>
                <div style={s.kpiCard}>
                  <div style={s.kpiValue}>{nearMissMonth.length}</div>
                  <div style={s.kpiLabel}>
                    {lang === "es" ? "Casi accidentes este mes" : "Near Miss This Month"}
                  </div>
                  <div style={s.kpiSub}>{lang === "es" ? "Mes actual" : "Current month"}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── REPORT TAB ── */}
          {activeTab === "report" && (
            <div style={s.section}>
              <div style={s.formGrid}>
                <div style={s.formCol}>
                  <div style={s.fieldGroup}>
                    <label style={s.fieldLabel}>
                      {lang === "es" ? "Fecha del incidente" : "Incident Date"} *
                    </label>
                    <input
                      type="date"
                      value={form.incident_date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setForm((p) => ({ ...p, incident_date: e.target.value }))}
                      style={s.input}
                    />
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={s.fieldLabel}>
                      {lang === "es" ? "Tipo de incidente" : "Incident Type"} *
                    </label>
                    <select
                      value={form.incident_type}
                      onChange={(e) => setForm((p) => ({ ...p, incident_type: e.target.value as IncidentType }))}
                      style={s.input}
                    >
                      {(Object.keys(INCIDENT_TYPE_LABELS) as IncidentType[]).map((k) => (
                        <option key={k} value={k}>{INCIDENT_TYPE_LABELS[k][lang]}</option>
                      ))}
                    </select>
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={s.fieldLabel}>
                      {lang === "es" ? "Severidad" : "Severity"} *
                    </label>
                    <select
                      value={form.severity}
                      onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value as Severity }))}
                      style={s.input}
                    >
                      {(Object.keys(SEVERITY_LABELS) as Severity[]).map((k) => (
                        <option key={k} value={k}>{SEVERITY_LABELS[k][lang]}</option>
                      ))}
                    </select>
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={s.fieldLabel}>
                      {lang === "es" ? "Área" : "Area"}
                    </label>
                    <select
                      value={form.area}
                      onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
                      style={s.input}
                    >
                      <option value="">{lang === "es" ? "Seleccionar..." : "Select..."}</option>
                      {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div style={s.formCol}>
                  <div style={s.fieldGroup}>
                    <label style={s.fieldLabel}>
                      {lang === "es" ? "Descripción" : "Description"} *
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      rows={4}
                      style={{ ...s.input, resize: "vertical" }}
                      placeholder={lang === "es" ? "Describe qué ocurrió, dónde y cómo..." : "Describe what happened, where, and how..."}
                    />
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={s.fieldLabel}>
                      {lang === "es" ? "Acciones inmediatas" : "Immediate Actions"}
                    </label>
                    <textarea
                      value={form.immediate_actions}
                      onChange={(e) => setForm((p) => ({ ...p, immediate_actions: e.target.value }))}
                      rows={3}
                      style={{ ...s.input, resize: "vertical" }}
                      placeholder={lang === "es" ? "¿Qué se hizo inmediatamente?" : "What was done immediately?"}
                    />
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={s.fieldLabel}>
                      {lang === "es" ? "Causa raíz preliminar" : "Preliminary Root Cause"}
                    </label>
                    <select
                      value={form.root_cause}
                      onChange={(e) => setForm((p) => ({ ...p, root_cause: e.target.value }))}
                      style={s.input}
                    >
                      <option value="">{lang === "es" ? "Seleccionar..." : "Select..."}</option>
                      {ROOT_CAUSES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {submitMsg && (
                <div style={{
                  ...s.msgBanner,
                  background: submitMsg.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.08)",
                  color:      submitMsg.type === "success" ? "#10b981" : "#ef4444",
                  border:     `1px solid ${submitMsg.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(220,38,38,0.2)"}`,
                }}>
                  {submitMsg.text}
                </div>
              )}

              <button
                style={s.submitBtn}
                onClick={handleSubmitIncident}
                disabled={submitting}
              >
                <Plus size={16} />
                {submitting
                  ? (lang === "es" ? "Enviando..." : "Submitting...")
                  : (lang === "es" ? "Reportar Incidente" : "Submit Report")}
              </button>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && (
            <div style={s.section}>
              {/* Filters */}
              <div style={s.filterRow}>
                <select
                  style={s.filterSelect}
                  value={filters.type ?? ""}
                  onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value as IncidentType || undefined }))}
                >
                  <option value="">{lang === "es" ? "Todos los tipos" : "All types"}</option>
                  {(Object.keys(INCIDENT_TYPE_LABELS) as IncidentType[]).map((k) => (
                    <option key={k} value={k}>{INCIDENT_TYPE_LABELS[k][lang]}</option>
                  ))}
                </select>

                <select
                  style={s.filterSelect}
                  value={filters.status ?? ""}
                  onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as IncidentStatus || undefined }))}
                >
                  <option value="">{lang === "es" ? "Todos los estados" : "All statuses"}</option>
                  {(["open", "in_progress", "closed"] as IncidentStatus[]).map((k) => (
                    <option key={k} value={k}>{STATUS_LABELS[k][lang]}</option>
                  ))}
                </select>

                <select
                  style={s.filterSelect}
                  value={filters.severity ?? ""}
                  onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value as Severity || undefined }))}
                >
                  <option value="">{lang === "es" ? "Todas las severidades" : "All severities"}</option>
                  {(Object.keys(SEVERITY_LABELS) as Severity[]).map((k) => (
                    <option key={k} value={k}>{SEVERITY_LABELS[k][lang]}</option>
                  ))}
                </select>
              </div>

              {/* Incident list */}
              {incidents.length === 0 ? (
                <div style={s.emptyState}>
                  <ShieldCheck size={36} color="var(--color-text-tertiary)" />
                  <p>{lang === "es" ? "Sin incidentes registrados" : "No incidents recorded"}</p>
                </div>
              ) : (
                <div style={s.incidentList}>
                  {incidents.map((incident) => (
                    <div key={incident.id} style={s.incidentCard}>
                      <div style={s.incidentHeader}>
                        <div style={s.incidentLeft}>
                          <span style={{
                            ...s.severityBadge,
                            background: `${SEVERITY_COLORS[incident.severity]}20`,
                            color: SEVERITY_COLORS[incident.severity],
                          }}>
                            {SEVERITY_LABELS[incident.severity][lang]}
                          </span>
                          <span style={s.incidentType}>
                            {INCIDENT_TYPE_LABELS[incident.incident_type][lang]}
                          </span>
                          <span style={s.incidentDate}>{incident.incident_date}</span>
                        </div>
                        <select
                          value={incident.status}
                          onChange={(e) => handleStatusChange(incident, e.target.value as IncidentStatus)}
                          style={{
                            ...s.statusSelect,
                            color: STATUS_COLORS[incident.status],
                            borderColor: STATUS_COLORS[incident.status],
                          }}
                        >
                          {(["open", "in_progress", "closed"] as IncidentStatus[]).map((k) => (
                            <option key={k} value={k}>{STATUS_LABELS[k][lang]}</option>
                          ))}
                        </select>
                      </div>
                      {incident.area && (
                        <div style={s.incidentArea}>
                          <AlertTriangle size={12} /> {incident.area}
                        </div>
                      )}
                      <div style={s.incidentDesc}>{incident.description}</div>
                      {incident.reported_by_name && (
                        <div style={s.incidentReporter}>
                          {lang === "es" ? "Reportado por:" : "Reported by:"} {incident.reported_by_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:         { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pageHeader:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title:        { fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  subtitle:     { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  errorBanner:  { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "rgba(220,38,38,0.08)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.875rem" },
  tabBar:       { display: "flex", gap: "0.25rem", borderBottom: "2px solid var(--color-border)", paddingBottom: "0" },
  tabBtn:       { padding: "0.625rem 1.25rem", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-secondary)", borderBottom: "2px solid transparent", marginBottom: "-2px" },
  tabBtnActive: { color: "var(--color-primary)", borderBottomColor: "var(--color-primary)", fontWeight: 600 },
  loadingState: { color: "var(--color-text-secondary)", padding: "2rem", textAlign: "center" },
  section:      { display: "flex", flexDirection: "column", gap: "1.25rem" },
  heroCard:     { display: "flex", alignItems: "center", gap: "1.5rem", padding: "1.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" },
  heroIcon:     { flexShrink: 0 },
  heroContent:  { display: "flex", flexDirection: "column", gap: "0.25rem" },
  heroDays:     { fontSize: "3rem", fontWeight: 800, color: "#10b981", lineHeight: 1 },
  heroLabel:    { fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" },
  heroSub:      { fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  updateRow:    { display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  fieldLabel:   { fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" },
  dateInput:    { padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  kpiGrid:      { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" },
  kpiCard:      { padding: "1.25rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "0.375rem" },
  kpiValue:     { fontSize: "2rem", fontWeight: 800, color: "var(--color-text-primary)" },
  kpiLabel:     { fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" },
  kpiSub:       { fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  formGrid:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" },
  formCol:      { display: "flex", flexDirection: "column", gap: "1rem" },
  fieldGroup:   { display: "flex", flexDirection: "column", gap: "0.375rem" },
  input:        { padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem", width: "100%", boxSizing: "border-box" as const },
  msgBanner:    { padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", fontSize: "0.875rem" },
  submitBtn:    { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem", borderRadius: "var(--radius-md)", background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, alignSelf: "flex-start" },
  filterRow:    { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  filterSelect: { padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" },
  emptyState:   { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "3rem", color: "var(--color-text-tertiary)" },
  incidentList: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  incidentCard: { padding: "1rem 1.25rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "0.5rem" },
  incidentHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" },
  incidentLeft: { display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" },
  severityBadge:{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "var(--radius-full, 9999px)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  incidentType: { fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" },
  incidentDate: { fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  statusSelect: { padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 },
  incidentArea: { display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" },
  incidentDesc: { fontSize: "0.875rem", color: "var(--color-text-primary)", lineHeight: 1.5 },
  incidentReporter: { fontSize: "0.75rem", color: "var(--color-text-tertiary)" },
};