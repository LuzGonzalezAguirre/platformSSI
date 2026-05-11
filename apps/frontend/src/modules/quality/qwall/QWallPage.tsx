import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import {
  QWallService,
  QWallReport,
  QWallRow,
  QWallInspectorRow,
  QWallPartRow,
  QWallFailMode,
  QWallPartNumber,
} from "../services/qwall.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = (): string => new Date().toISOString().slice(0, 10);
const daysAgo  = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function passRateColor(rate: number): string {
  if (rate >= 95) return "#10b981";
  if (rate >= 85) return "#f59e0b";
  return "#ef4444";
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
  page:    { padding: "1.5rem", display: "flex", flexDirection: "column" as const, gap: "1.5rem" },
  header:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: "1rem" },
  title:   { fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  sub:     { fontSize: "0.8rem",  color: "var(--color-text-secondary)", margin: 0 },
  filters: { display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" as const },
  label:   { fontSize: "0.8rem", color: "var(--color-text-secondary)" },
  input: {
    padding: "0.375rem 0.625rem", borderRadius: "6px", fontSize: "0.85rem",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", outline: "none",
  },
  btn: {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.375rem 0.875rem", borderRadius: "6px", fontSize: "0.82rem",
    fontWeight: 600, cursor: "pointer", border: "none",
    background: "var(--color-primary)", color: "#fff",
  },
  btnOutline: {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.375rem 0.875rem", borderRadius: "6px", fontSize: "0.82rem",
    fontWeight: 600, cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)", color: "var(--color-text-primary)",
  },
  kpiGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" },
  kpiCard:  { background: "var(--color-surface)", borderRadius: "10px", border: "1px solid var(--color-border)", padding: "1rem 1.25rem" },
  kpiLabel: { fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" },
  kpiValue: { fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" },
  kpiSub:   { fontSize: "0.72rem", color: "var(--color-text-secondary)", marginTop: "0.15rem" },
  section:  { background: "var(--color-surface)", borderRadius: "10px", border: "1px solid var(--color-border)", padding: "1.25rem" },
  secTitle: { fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "1rem" },
  grid2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  table:    { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.82rem" },
  th:       { padding: "0.5rem 0.75rem", textAlign: "left" as const, fontWeight: 600, fontSize: "0.75rem", color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)" },
  td:       { padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-primary)" },
  badge:    (pass: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "999px",
    fontSize: "0.72rem", fontWeight: 700,
    background: pass ? "#d1fae5" : "#fee2e2",
    color:      pass ? "#065f46" : "#991b1b",
  }),
  error:   { padding: "1rem", borderRadius: "8px", background: "#fee2e2", color: "#991b1b", fontSize: "0.85rem" },
  loading: { padding: "3rem", textAlign: "center" as const, color: "var(--color-text-secondary)" },
};

// ── Componente KPI ────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={s.kpiCard}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color: color ?? "var(--color-text-primary)" }}>{value}</div>
      {sub && <div style={s.kpiSub}>{sub}</div>}
    </div>
  );
}

// ── Barra horizontal inline SVG ───────────────────────────────────────────────

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <svg width="80" height="10" style={{ verticalAlign: "middle" }}>
      <rect x={0} y={2} width={80}                    height={6} rx={3} fill="var(--color-border)" />
      <rect x={0} y={2} width={Math.round(pct * 0.8)} height={6} rx={3} fill={color} />
    </svg>
  );
}

// ── Filtros de tabla ──────────────────────────────────────────────────────────

interface TableFilters {
  filtered:     QWallRow[];
  inspector:    string;
  setInspector: (v: string) => void;
  result:       "" | "PASS" | "FAIL";
  setResult:    (v: "" | "PASS" | "FAIL") => void;
  partNo:       string;
  setPartNo:    (v: string) => void;
  inspectors:   string[];
  partNumbers:  string[];
}

function useTableFilters(rows: QWallRow[], pnForBu: string[]): TableFilters {
  const [inspector, setInspector] = useState<string>("");
  const [result,    setResult]    = useState<"" | "PASS" | "FAIL">("");
  const [partNo,    setPartNo]    = useState<string>("");

  // Filtrar por BU primero
  const buFiltered: QWallRow[] = pnForBu.length > 0
    ? rows.filter((r) => pnForBu.includes(r.part_number))
    : rows;

  const inspectors:  string[] = [...new Set<string>(buFiltered.map((r) => r.inspector))].sort();
  const partNumbers: string[] = [...new Set<string>(buFiltered.map((r) => r.part_number))].sort();

  const filtered: QWallRow[] = buFiltered.filter((r) =>
    (!inspector || r.inspector   === inspector) &&
    (!result    || r.result      === result)    &&
    (!partNo    || r.part_number === partNo)
  );

  return {
    filtered, inspector, setInspector,
    result, setResult, partNo, setPartNo,
    inspectors, partNumbers,
  };
}

// ── KPIs derivados del subset filtrado ───────────────────────────────────────

function deriveKpis(rows: QWallRow[]) {
  const total      = rows.length;
  const pass       = rows.filter((r) => r.result === "PASS").length;
  const fail       = total - pass;
  const pass_rate  = total ? Math.round((pass / total) * 10000) / 100 : 0;
  const durations  = rows.map((r) => r.duration_seconds).filter(Boolean);
  const avg_duration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  const inspectors  = new Set(rows.map((r) => r.inspector)).size;
  const part_numbers = new Set(rows.map((r) => r.part_number)).size;
  return { total, pass, fail, pass_rate, avg_duration, inspectors, part_numbers };
}

function deriveByInspector(rows: QWallRow[]): QWallInspectorRow[] {
  const map: Record<string, { total: number; pass: number; dur: number }> = {};
  for (const r of rows) {
    if (!map[r.inspector]) map[r.inspector] = { total: 0, pass: 0, dur: 0 };
    map[r.inspector].total += 1;
    if (r.result === "PASS") map[r.inspector].pass += 1;
    if (r.duration_seconds)  map[r.inspector].dur  += r.duration_seconds;
  }
  return Object.entries(map).map(([inspector, s]) => ({
    inspector,
    total:        s.total,
    pass:         s.pass,
    fail:         s.total - s.pass,
    pass_rate:    s.total ? Math.round((s.pass / s.total) * 1000) / 10 : 0,
    avg_duration: s.total ? Math.round(s.dur / s.total) : 0,
  }));
}

function deriveByPart(rows: QWallRow[]): QWallPartRow[] {
  const map: Record<string, { total: number; pass: number }> = {};
  for (const r of rows) {
    if (!map[r.part_number]) map[r.part_number] = { total: 0, pass: 0 };
    map[r.part_number].total += 1;
    if (r.result === "PASS") map[r.part_number].pass += 1;
  }
  return Object.entries(map).map(([part_number, s]) => ({
    part_number,
    total:     s.total,
    pass:      s.pass,
    fail:      s.total - s.pass,
    pass_rate: s.total ? Math.round((s.pass / s.total) * 1000) / 10 : 0,
  })).sort((a, b) => b.total - a.total);
}

function deriveFailModes(rows: QWallRow[]): QWallFailMode[] {
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.result === "FAIL" && r.fail_modes) {
      for (const fm of r.fail_modes.split(",")) {
        const key = fm.trim();
        if (key) map[key] = (map[key] ?? 0) + 1;
      }
    }
  }
  return Object.entries(map)
    .map(([fail_mode, count]) => ({ fail_mode, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function QWallPage() {
  const { i18n } = useTranslation();
  const l        = i18n.language === "es";

  const [startDate,   setStartDate]   = useState<string>(daysAgo(7));
  const [endDate,     setEndDate]     = useState<string>(todayStr());
  const [data,        setData]        = useState<QWallReport | null>(null);
  const [loading,     setLoading]     = useState<boolean>(false);
  const [error,       setError]       = useState<string | null>(null);
  const [includeTest, setIncludeTest] = useState<boolean>(false);

  // Catálogo BU / PN
  const [partCatalog, setPartCatalog] = useState<QWallPartNumber[]>([]);
  const [buFilter,    setBuFilter]    = useState<string>("");

  useEffect(() => {
    QWallService.getPartNumbers().then(setPartCatalog).catch(() => {});
  }, []);

  const buList: string[] = [...new Set(partCatalog.map((p) => p.bu_name))].sort();

  const pnForBu: string[] = buFilter
    ? partCatalog.filter((p) => p.bu_name === buFilter).map((p) => p.ssiPN)
    : partCatalog.map((p) => p.ssiPN);

  const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await QWallService.getReport(startDate, endDate, includeTest);
    setData(result);
  } catch {
    setError(l ? "Error al cargar datos de Q-Wall." : "Failed to load Q-Wall data.");
  } finally {
    setLoading(false);
  }
}, [startDate, endDate, includeTest, l]);

// Auto-reload cuando cambia el toggle (solo si ya hay datos)
useEffect(() => {
  if (data !== null) {
    load();
  }
}, [includeTest]);

  const filters = useTableFilters(data?.rows ?? [], pnForBu);

  // Reset partNo al cambiar BU
  useEffect(() => {
    filters.setPartNo("");
  }, [buFilter]);

  // KPIs y aggregados derivados del subset BU-filtrado
  const subsetRows  = filters.filtered;
  const allBuRows   = pnForBu.length > 0
    ? (data?.rows ?? []).filter((r) => pnForBu.includes(r.part_number))
    : (data?.rows ?? []);

  const kpis        = deriveKpis(allBuRows);
  const byInspector = deriveByInspector(allBuRows);
  const byPart      = deriveByPart(allBuRows);
  const failModes   = deriveFailModes(allBuRows);

  return (
    <div style={s.page}>

      {/* HEADER */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{l ? "Reporte Q-Wall" : "Q-Wall Report"}</h1>
          <p style={s.sub}>
            {l ? "Inspecciones de calidad — vista consolidada" : "Quality inspections — consolidated view"}
          </p>
        </div>

        <div style={s.filters}>
          <span style={s.label}>{l ? "Desde:" : "From:"}</span>
          <input type="date" value={startDate} max={endDate} style={s.input}
            onChange={(e) => setStartDate(e.target.value)} />

          <span style={s.label}>{l ? "Hasta:" : "To:"}</span>
          <input type="date" value={endDate} max={todayStr()} style={s.input}
            onChange={(e) => setEndDate(e.target.value)} />

          {/* Filtro BU */}
          <select
            style={s.input}
            value={buFilter}
            onChange={(e) => setBuFilter(e.target.value)}
          >
            <option value="">{l ? "— Todas las BU —" : "— All BUs —"}</option>
            {buList.map((bu) => (
              <option key={bu} value={bu}>{bu}</option>
            ))}
          </select>

          {/* Toggle pruebas/producción */}
          <button
            style={{
              ...s.btnOutline,
              background: includeTest ? "rgba(245,158,11,0.12)" : "var(--color-surface)",
              color:      includeTest ? "#f59e0b"               : "var(--color-text-secondary)",
              border:     includeTest ? "1px solid #f59e0b"     : "1px solid var(--color-border)",
              fontWeight: includeTest ? 700                      : 600,
            }}
            onClick={() => setIncludeTest((v) => !v)}
            title={l
              ? "Alternar entre producción y pruebas"
              : "Toggle between production and tests"}
          >
             {includeTest
              ? (l ? "Pruebas"    : "Tests")
              : (l ? "Producción" : "Production")}
          </button>

          <button style={s.btn} onClick={load}>
            {loading
              ? (l ? "Cargando..." : "Loading...")
              : (l ? "Consultar"   : "Load")}
          </button>

          {data && (
            <button
              style={s.btnOutline}
              onClick={() => QWallService.downloadExcel(startDate, endDate, includeTest)}
            >
              <Download size={13} /> Excel
            </button>
          )}
        </div>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {!data && !loading && (
        <div style={s.loading}>
          {l
            ? "Selecciona un rango y presiona Consultar."
            : "Select a date range and press Load."}
        </div>
      )}

      {loading && (
        <div style={s.loading}>
          {l ? "Consultando base de datos..." : "Querying database..."}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Badge modo activo */}
          {buFilter && (
            <div>
              <span style={{
                background: "rgba(59,130,246,0.1)", color: "#3b82f6",
                border: "1px solid #3b82f6", borderRadius: 8,
                padding: "0.25rem 0.75rem", fontSize: "0.8rem", fontWeight: 600,
              }}>
                BU: {buFilter} · {kpis.total} {l ? "inspecciones" : "inspections"}
              </span>
            </div>
          )}

          {/* KPIs — derivados del subset BU */}
          <div style={s.kpiGrid}>
            <KPI
              label={l ? "Total inspecciones" : "Total inspections"}
              value={kpis.total.toLocaleString()}
            />
            <KPI label="PASS" value={kpis.pass.toLocaleString()} color="#10b981" />
            <KPI label="FAIL" value={kpis.fail.toLocaleString()} color="#ef4444" />
            <KPI
              label={l ? "Tasa de aprobación" : "Pass rate"}
              value={`${kpis.pass_rate.toFixed(1)}%`}
              color={passRateColor(kpis.pass_rate)}
            />
            <KPI
              label={l ? "Tiempo promedio" : "Avg. cycle time"}
              value={fmtDuration(kpis.avg_duration)}
              sub="mm:ss"
            />
            <KPI
              label={l ? "Inspectores" : "Inspectors"}
              value={String(kpis.inspectors)}
            />
            <KPI label="Part Numbers" value={String(kpis.part_numbers)} />
          </div>

          {/* Inspector + Fail modes */}
          <div style={s.grid2}>

            <div style={s.section}>
              <div style={s.secTitle}>
                {l ? "Rendimiento por inspector" : "Performance by inspector"}
              </div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>{l ? "Inspector" : "Inspector"}</th>
                    <th style={s.th}>Total</th>
                    <th style={s.th}>PASS %</th>
                    <th style={s.th}>{l ? "Tiempo prom." : "Avg. time"}</th>
                  </tr>
                </thead>
                <tbody>
                  {byInspector.map((row: QWallInspectorRow) => (
                    <tr key={row.inspector}>
                      <td style={s.td}>{row.inspector}</td>
                      <td style={s.td}>{row.total}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Bar pct={row.pass_rate} color={passRateColor(row.pass_rate)} />
                          <span style={{ color: passRateColor(row.pass_rate), fontWeight: 600 }}>
                            {row.pass_rate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={s.td}>{fmtDuration(row.avg_duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={s.section}>
              <div style={s.secTitle}>
                {l ? "Modos de falla (Pareto)" : "Fail modes (Pareto)"}
              </div>
              {failModes.length === 0 ? (
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                  {l ? "Sin fallas registradas." : "No failures recorded."}
                </p>
              ) : (() => {
                const max = failModes[0]?.count ?? 1;
                return (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>{l ? "Modo de falla" : "Fail mode"}</th>
                        <th style={s.th}>{l ? "Cant." : "Count"}</th>
                        <th style={s.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {failModes.map((fm: QWallFailMode) => (
                        <tr key={fm.fail_mode}>
                          <td style={s.td}>{fm.fail_mode}</td>
                          <td style={{ ...s.td, fontWeight: 700 }}>{fm.count}</td>
                          <td style={s.td}>
                            <Bar pct={(fm.count / max) * 100} color="#ef4444" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* Por part number */}
          <div style={s.section}>
            <div style={s.secTitle}>
              {l ? "Desglose por part number" : "By part number"}
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Part Number</th>
                  <th style={s.th}>Total</th>
                  <th style={s.th}>PASS</th>
                  <th style={s.th}>FAIL</th>
                  <th style={s.th}>PASS %</th>
                </tr>
              </thead>
              <tbody>
                {byPart.map((row: QWallPartRow) => (
                  <tr key={row.part_number}>
                    <td style={{ ...s.td, fontFamily: "monospace" }}>{row.part_number}</td>
                    <td style={s.td}>{row.total}</td>
                    <td style={{ ...s.td, color: "#10b981" }}>{row.pass}</td>
                    <td style={{ ...s.td, color: "#ef4444" }}>{row.fail}</td>
                    <td style={s.td}>
                      <span style={{ color: passRateColor(row.pass_rate), fontWeight: 600 }}>
                        {row.pass_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabla detalle con filtros */}
          <div style={s.section}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "0.75rem", flexWrap: "wrap" as const, gap: "0.5rem",
            }}>
              <div style={s.secTitle}>
                {l ? "Detalle de inspecciones" : "Inspection detail"}
                <span style={{
                  marginLeft: "0.75rem", fontSize: "0.75rem", fontWeight: 400,
                  color: "var(--color-text-secondary)",
                }}>
                  ({subsetRows.length} {l ? "registros" : "records"})
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>

                <select style={s.input} value={filters.inspector}
                  onChange={(e) => filters.setInspector(e.target.value)}>
                  <option value="">{l ? "— Inspector —" : "— Inspector —"}</option>
                  {filters.inspectors.map((i: string) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>

                <select style={s.input} value={filters.result}
                  onChange={(e) => filters.setResult(e.target.value as "" | "PASS" | "FAIL")}>
                  <option value="">{l ? "— Resultado —" : "— Result —"}</option>
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                </select>

                <select style={s.input} value={filters.partNo}
                  onChange={(e) => filters.setPartNo(e.target.value)}>
                  <option value="">{l ? "— Part No. —" : "— Part No. —"}</option>
                  {filters.partNumbers.map((p: string) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>

              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {[
                      l ? "Fecha"     : "Date",
                      l ? "Semana"    : "Week",
                      l ? "Inspector" : "Inspector",
                      l ? "Tipo"      : "Type",
                      l ? "Resultado" : "Result",
                      "WO",
                      "Part No.",
                      "Serial SSI",
                      "Serial Volvo",
                      l ? "Duración"  : "Duration",
                      l ? "Fallas"    : "Fail modes",
                    ].map((h: string) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subsetRows.map((row: QWallRow) => (
                    <tr
                      key={row.inspection_id}
                      style={{ background: row.result === "FAIL" ? "rgba(239,68,68,0.04)" : undefined }}
                    >
                      <td style={s.td}>{row.inspection_date}</td>
                      <td style={s.td}>{row.week_number}</td>
                      <td style={s.td}>{row.inspector}</td>
                      <td style={s.td}>{row.inspection_type}</td>
                      <td style={s.td}>
                        <span style={s.badge(row.result === "PASS")}>{row.result}</span>
                      </td>
                      <td style={{ ...s.td, fontFamily: "monospace" }}>{row.work_order}</td>
                      <td style={{ ...s.td, fontFamily: "monospace" }}>{row.part_number}</td>
                      <td style={{ ...s.td, fontFamily: "monospace" }}>{row.serial_ssi}</td>
                      <td style={{ ...s.td, fontFamily: "monospace" }}>{row.serial_volvo}</td>
                      <td style={s.td}>{fmtDuration(row.duration_seconds)}</td>
                      <td style={{
                        ...s.td,
                        color: row.fail_modes ? "#ef4444" : "var(--color-text-secondary)",
                        maxWidth: "220px",
                      }}>
                        {row.fail_modes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {subsetRows.length === 0 && (
                <p style={{
                  textAlign: "center", padding: "1.5rem",
                  color: "var(--color-text-secondary)", fontSize: "0.85rem",
                }}>
                  {l
                    ? "Sin registros con los filtros actuales."
                    : "No records match the current filters."}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}