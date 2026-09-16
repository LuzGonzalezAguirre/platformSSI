import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity, AlertTriangle, Clock3, Factory, RefreshCw, Search, Siren, X,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDownEquipmentData } from "./useDownEquipmentData";
import { DownEquipmentItem, DownSeverity, RecurrentEquipment } from "./types";

const severityColors: Record<DownSeverity, { bg: string; color: string; labelEs: string; labelEn: string }> = {
  normal: { bg: "rgba(34,197,94,.13)", color: "#16a34a", labelEs: "Menos de 1 h", labelEn: "Under 1 h" },
  warning: { bg: "rgba(245,158,11,.14)", color: "#d97706", labelEs: "Atención", labelEn: "Warning" },
  high: { bg: "rgba(239,68,68,.13)", color: "#ef4444", labelEs: "Alta", labelEn: "High" },
  critical: { bg: "rgba(127,29,29,.16)", color: "#991b1b", labelEs: "Crítica", labelEn: "Critical" },
};

function formatDuration(minutes: number, lang: string) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days) parts.push(days + (lang === "es" ? " d" : " d"));
  if (hours || days) parts.push(hours + " h");
  parts.push(mins + " min");
  return parts.join(" ");
}

function localDate(value: string, lang: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(lang === "es" ? "es-MX" : "en-US", {
        month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
      });
}

export default function DownEquipmentPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const [days, setDays] = useState(30);
  const { data, loading, error, fetchedAt, reload } = useDownEquipmentData(days);
  const [search, setSearch] = useState("");
  const [bu, setBu] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [selectedRecurrent, setSelectedRecurrent] = useState<RecurrentEquipment | null>(null);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedRecurrent) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRecurrent(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedRecurrent]);

  const liveMinutes = (row: DownEquipmentItem) =>
    row.elapsed_minutes + Math.max(Math.floor((Date.now() - fetchedAt) / 60_000), 0);

  const buOptions = useMemo(
    () => Array.from(new Set((data?.rows ?? []).map((row) => row.bu))).sort(),
    [data],
  );

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.rows ?? []).filter((row) => {
      const matchesSearch = !term || [
        row.equipment_id, row.equipment_description, row.workcenter,
        row.workcenter_group, row.reason, row.notes,
      ].some((value) => value.toLowerCase().includes(term));
      return matchesSearch
        && (bu === "all" || row.bu === bu)
        && (severity === "all" || row.severity === severity);
    });
  }, [data, search, bu, severity]);

  const s = styles;
  const tr = (es: string, en: string) => lang === "es" ? es : en;

  return (
    <div style={s.page}>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      <header style={s.header}>
        <div>
          <div style={s.titleRow}>
            <span style={s.titleIcon}><Siren size={20} /></span>
            <div>
              <h1 style={s.title}>{tr("Equipos caídos", "Down Equipment")}</h1>
              <p style={s.subtitle}>
                {tr("Estado actual directo de Plex; no depende de horas cerradas.", "Live Plex status; it does not depend on closed hours.")}
              </p>
            </div>
          </div>
        </div>
        <div style={s.headerActions}>
          <span style={s.freshness}>
            <Activity size={14} color="#16a34a" />
            {tr("Plex actualizado", "Plex updated")}: {data ? localDate(data.as_of, lang) : "—"}
          </span>
          <button type="button" onClick={reload} disabled={loading} style={s.refreshButton}>
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
            {tr("Actualizar", "Refresh")}
          </button>
        </div>
      </header>

      {error && <div style={s.error}>{tr("No fue posible consultar Plex.", "Could not query Plex.")} {error}</div>}

      <section style={s.kpiGrid}>
        <KpiCard icon={<Factory size={18} />} label={tr("Caídos ahora", "Down now")} value={data?.kpis.currently_down ?? "—"} tone="#ef4444" />
        <KpiCard icon={<AlertTriangle size={18} />} label={tr("Más de 2 horas", "Over 2 hours")} value={data?.kpis.critical ?? "—"} tone="#d97706" />
        <KpiCard icon={<Clock3 size={18} />} label={tr("Mayor duración", "Longest duration")} value={data ? formatDuration(data.kpis.longest_minutes, lang) : "—"} detail={data?.kpis.longest_equipment ?? undefined} tone="#7c3aed" />
        <KpiCard icon={<Siren size={18} />} label={tr("BU más afectada", "Most affected BU")} value={data?.kpis.most_affected_bu ?? "—"} tone="#2563eb" />
      </section>

      <section style={s.card}>
        <div style={s.sectionHeading}>
          <div>
            <h2 style={s.sectionTitle}>{tr("Estado actual", "Current status")}</h2>
            <p style={s.sectionSubtitle}>{visibleRows.length} {tr("equipos visibles", "visible equipment")}</p>
          </div>
          <div style={s.filters}>
            <label style={s.searchBox}>
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("Buscar equipo, falla...", "Search equipment, failure...")} style={s.searchInput} />
            </label>
            <select value={bu} onChange={(event) => setBu(event.target.value)} style={s.select}>
              <option value="all">{tr("Todas las BU", "All BUs")}</option>
              {buOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} style={s.select}>
              <option value="all">{tr("Toda criticidad", "All severity")}</option>
              {(Object.keys(severityColors) as DownSeverity[]).map((value) => (
                <option key={value} value={value}>
                  {lang === "es" ? severityColors[value].labelEs : severityColors[value].labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {[tr("Estado", "Status"), tr("Equipo", "Equipment"), "BU", "Workcenter", tr("Caído desde", "Down since"), tr("Tiempo actual", "Current time"), tr("Motivo", "Reason"), tr("Notas", "Notes")].map((label) => (
                  <th key={label} style={s.th}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && visibleRows.length === 0 && (
                <tr><td colSpan={8} style={s.empty}>{tr("No hay equipos caídos con estos filtros.", "No down equipment matches these filters.")}</td></tr>
              )}
              {visibleRows.map((row) => {
                const palette = severityColors[row.severity];
                return (
                  <tr key={row.equipment_id + row.started_at} style={s.tr}>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: palette.bg, color: palette.color }}>
                        <span style={{ ...s.dot, background: palette.color }} />
                        {lang === "es" ? palette.labelEs : palette.labelEn}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={s.primary}>{row.equipment_id}</div>
                      <div style={s.secondary}>{row.equipment_description}</div>
                    </td>
                    <td style={s.td}><span style={s.buBadge}>{row.bu}</span></td>
                    <td style={s.td}>
                      <div style={s.primary}>{row.workcenter || "—"}</div>
                      <div style={s.secondary}>{row.workcenter_group}</div>
                    </td>
                    <td style={s.td}>{localDate(row.started_at, lang)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: palette.color }}>{formatDuration(liveMinutes(row), lang)}</td>
                    <td style={s.td}>{row.reason || "—"}</td>
                    <td style={{ ...s.td, maxWidth: 260 }} title={row.notes}>{row.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={s.card}>
        <div style={s.sectionHeading}>
          <div>
            <h2 style={s.sectionTitle}>{tr("Tendencias de downtime cerrado", "Closed downtime trends")}</h2>
            <p style={s.sectionSubtitle}>{tr("El estado actual y la historia se mantienen separados.", "Current state and history remain separate.")}</p>
          </div>
          <div style={s.segmented}>
            {[7, 30, 90].map((value) => (
              <button key={value} type="button" onClick={() => { setDays(value); setSelectedRecurrent(null); }} style={{ ...s.segmentButton, ...(days === value ? s.segmentActive : {}) }}>
                {value} {tr("días", "days")}
              </button>
            ))}
          </div>
        </div>
        <div style={s.chartGrid}>
          <ChartCard title={tr("Horas caídas por día", "Downtime hours by day")}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.trends.by_day ?? []} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value) => String(value).slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: any) => [Number(value).toFixed(1) + " h", tr("Horas", "Hours")]} />
                <Bar dataKey="hours" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title={tr("Horas por Business Unit", "Hours by Business Unit")}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.trends.by_bu ?? []} layout="vertical" margin={{ top: 12, right: 18, left: 18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="bu" width={92} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: any) => [Number(value).toFixed(1) + " h", tr("Horas", "Hours")]} />
                <Bar dataKey="hours" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <h3 style={s.chartTitle}>{tr("Equipos con mayor recurrencia", "Most recurrent equipment")}</h3>
          <div style={s.recurrentGrid}>
            {(data?.trends.recurrent ?? []).map((item, index) => (
              <button
                key={item.equipment_id}
                type="button"
                style={s.recurrentItem}
                onClick={() => setSelectedRecurrent(item)}
                aria-label={tr(
                  "Ver eventos de " + item.equipment_id,
                  "View events for " + item.equipment_id,
                )}
              >
                <span style={s.rank}>{index + 1}</span>
                <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                  <span style={{ ...s.primary, display: "block" }}>{item.equipment_id}</span>
                  <span style={{ ...s.secondary, display: "block" }}>{item.description}</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ ...s.primary, display: "block" }}>{item.events} {tr("eventos", "events")}</span>
                  <span style={{ ...s.secondary, display: "block" }}>{item.hours.toFixed(1)} h · {tr("Ver detalle", "View detail")}</span>
                </span>
              </button>
            ))}
            {!data?.trends.recurrent.length && <div style={s.empty}>{tr("Sin historial en el rango.", "No history in this range.")}</div>}
          </div>
        </div>
      </section>

      {selectedRecurrent && (
        <div style={s.modalBackdrop} role="presentation" onMouseDown={() => setSelectedRecurrent(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurrent-events-title"
            style={s.modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header style={s.modalHeader}>
              <div>
                <h2 id="recurrent-events-title" style={s.modalTitle}>
                  {selectedRecurrent.equipment_id} · {tr("Eventos de downtime", "Downtime events")}
                </h2>
                <p style={s.modalSubtitle}>
                  {selectedRecurrent.description} · {selectedRecurrent.events} {tr("eventos", "events")} · {selectedRecurrent.hours.toFixed(1)} h
                </p>
              </div>
              <button type="button" onClick={() => setSelectedRecurrent(null)} style={s.closeButton} aria-label={tr("Cerrar", "Close")}>
                <X size={18} />
              </button>
            </header>

            <div style={s.modalTableWrap}>
              <table style={s.modalTable}>
                <thead>
                  <tr>
                    <th style={s.th}>{tr("Fecha", "Date")}</th>
                    <th style={s.th}>{tr("Duración", "Duration")}</th>
                    <th style={s.th}>{tr("Motivo", "Reason")}</th>
                    <th style={s.th}>BU</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecurrent.event_items.map((event, index) => (
                    <tr key={event.date + "-" + event.reason + "-" + index} style={s.tr}>
                      <td style={s.td}>{event.date || "—"}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{event.hours.toFixed(2)} h</td>
                      <td style={s.td}>{event.reason || tr("Sin razón", "No reason")}</td>
                      <td style={s.td}><span style={s.buBadge}>{event.bu}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail?: string; tone: string }) {
  return (
    <div style={styles.kpiCard}>
      <span style={{ ...styles.kpiIcon, color: tone, background: tone + "18" }}>{icon}</span>
      <div>
        <div style={styles.kpiLabel}>{label}</div>
        <div style={styles.kpiValue}>{value}</div>
        {detail && <div style={styles.secondary}>{detail}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={styles.chartCard}><h3 style={styles.chartTitle}>{title}</h3>{children}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", gap: "1rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  titleRow: { display: "flex", alignItems: "center", gap: "0.75rem" },
  titleIcon: { width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(239,68,68,.12)", color: "#ef4444" },
  title: { margin: 0, fontSize: "1.4rem", color: "var(--color-text-primary)" },
  subtitle: { margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary)" },
  headerActions: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" },
  freshness: { display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  refreshButton: { display: "flex", alignItems: "center", gap: "0.4rem", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", borderRadius: 8, padding: "0.5rem 0.75rem", cursor: "pointer" },
  error: { padding: "0.75rem 1rem", border: "1px solid #ef4444", borderRadius: 8, background: "rgba(239,68,68,.1)", color: "#ef4444" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem" },
  kpiCard: { display: "flex", alignItems: "center", gap: "0.8rem", padding: "1rem", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)" },
  kpiIcon: { width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0 },
  kpiLabel: { fontSize: "0.72rem", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: ".04em" },
  kpiValue: { marginTop: 3, fontSize: "1.35rem", fontWeight: 750, color: "var(--color-text-primary)" },
  card: { padding: "1rem", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)" },
  sectionHeading: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "0.8rem" },
  sectionTitle: { margin: 0, fontSize: "0.95rem", color: "var(--color-text-primary)" },
  sectionSubtitle: { margin: "0.2rem 0 0", fontSize: "0.72rem", color: "var(--color-text-secondary)" },
  filters: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  searchBox: { display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 220, padding: "0 0.6rem", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text-secondary)", background: "var(--color-bg)" },
  searchInput: { width: "100%", height: 34, border: "none", outline: "none", color: "var(--color-text-primary)", background: "transparent" },
  select: { height: 36, padding: "0 0.6rem", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text-primary)", background: "var(--color-bg)" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 980, fontSize: "0.76rem" },
  th: { padding: "0.65rem", textAlign: "left", color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)", fontWeight: 650, whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid var(--color-border)" },
  td: { padding: "0.7rem 0.65rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  primary: { fontWeight: 650, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  secondary: { marginTop: 2, fontSize: "0.68rem", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badge: { display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.25rem 0.5rem", borderRadius: 999, fontWeight: 650, whiteSpace: "nowrap" },
  dot: { width: 7, height: 7, borderRadius: "50%" },
  buBadge: { display: "inline-block", padding: "0.2rem 0.45rem", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", fontSize: "0.68rem", fontWeight: 650 },
  empty: { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  segmented: { display: "flex", padding: 2, border: "1px solid var(--color-border)", borderRadius: 8 },
  segmentButton: { border: "none", borderRadius: 6, padding: "0.35rem 0.55rem", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.72rem" },
  segmentActive: { background: "var(--color-primary)", color: "#fff" },
  chartGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" },
  chartCard: { minWidth: 0, padding: "0.8rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 10 },
  chartTitle: { margin: "0 0 0.65rem", fontSize: "0.8rem", color: "var(--color-text-primary)" },
  recurrentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.5rem" },
  recurrentItem: { width: "100%", display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem", border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", color: "inherit", font: "inherit", cursor: "pointer" },
  rank: { width: 25, height: 25, display: "grid", placeItems: "center", borderRadius: 7, background: "rgba(37,99,235,.12)", color: "#2563eb", fontWeight: 750, fontSize: "0.72rem", flexShrink: 0 },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(15,23,42,.58)", backdropFilter: "blur(2px)" },
  modal: { width: "min(760px, 100%)", maxHeight: "min(720px, 88vh)", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--color-border)", borderRadius: 14, background: "var(--color-surface)", boxShadow: "0 24px 70px rgba(0,0,0,.32)" },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", padding: "1rem 1.1rem", borderBottom: "1px solid var(--color-border)" },
  modalTitle: { margin: 0, fontSize: "1rem", color: "var(--color-text-primary)" },
  modalSubtitle: { margin: "0.3rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  closeButton: { width: 34, height: 34, display: "grid", placeItems: "center", flexShrink: 0, border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", color: "var(--color-text-primary)", cursor: "pointer" },
  modalTableWrap: { overflow: "auto", padding: "0 1rem 1rem" },
  modalTable: { width: "100%", borderCollapse: "collapse", minWidth: 560, fontSize: "0.78rem" },
};
