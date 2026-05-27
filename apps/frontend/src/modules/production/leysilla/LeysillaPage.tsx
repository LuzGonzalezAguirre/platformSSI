import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import { Download } from "lucide-react";
import { AssistanceService } from "../assistance/assistance.service";
import { generateTrainingPdf } from "./generateTrainingPdf";

const today  = new Date().toISOString().slice(0, 10);
const thirty = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

const TURNO_COLORS: Record<string, string> = { A: "#0070C0", B: "#00B050" };

export default function LeysillaPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [start, setStart]     = useState(thirty);
  const [end, setEnd]         = useState(today);
  const [turno, setTurno]     = useState("");
  const [filters, setFilters] = useState({ start_date: thirty, end_date: today, turno: "" });
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: kpis,   isLoading: kpiLoading   } = useQuery({ queryKey: ["chair-kpis",   filters],             queryFn: () => AssistanceService.getChairKpis(filters) });
  const { data: daily,  isLoading: dailyLoading  } = useQuery({ queryKey: ["chair-daily",  filters],             queryFn: () => AssistanceService.getChairDailyChart(filters) });
  const { data: turnoD, isLoading: turnoLoading  } = useQuery({ queryKey: ["chair-turno",  filters],             queryFn: () => AssistanceService.getChairTurnoChart(filters) });
  const { data: breaks, isLoading: brksLoading   } = useQuery({ queryKey: ["chair-breaks", filters, page, search], queryFn: () => AssistanceService.getChairBreaks({ ...filters, page, page_size: 20, search }) });

  const apply = () => { setFilters({ start_date: start, end_date: end, turno }); setPage(1); };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const all = await AssistanceService.getChairBreaks({
        start_date: filters.start_date,
        end_date:   filters.end_date,
        turno:      filters.turno,
        page:       1,
        page_size:  1000,
      });
      await generateTrainingPdf(all.results ?? [], filters.start_date, filters.end_date);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          {lang === "es" ? "Ley Silla" : "Chair Law"}
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" }}>
          {lang === "es" ? "Control de descansos y cumplimiento" : "Break control and compliance tracking"}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end",
        padding: "1rem", background: "var(--color-surface)", borderRadius: 8,
        border: "1px solid var(--color-border)" }}>
        {[
          { label: lang === "es" ? "Inicio" : "Start", val: start, set: setStart },
          { label: lang === "es" ? "Fin"    : "End",   val: end,   set: setEnd   },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</label>
            <input type="date" value={val} onChange={(e) => set(e.target.value)}
              style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", fontSize: "0.875rem", background: "var(--color-surface)", color: "var(--color-text-primary)" }} />
          </div>
        ))}
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>Turno</label>
          <select value={turno} onChange={(e) => setTurno(e.target.value)}
            style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", fontSize: "0.875rem", background: "var(--color-surface)", color: "var(--color-text-primary)" }}>
            <option value="">{lang === "es" ? "Todos" : "All"}</option>
            <option value="A">Turno A</option>
            <option value="B">Turno B</option>
          </select>
        </div>
        <button onClick={apply} style={{ background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
          {lang === "es" ? "Aplicar" : "Apply"}
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          style={{ display: "flex", alignItems: "center", gap: 6, background: pdfLoading ? "var(--color-border)" : "#00703C", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: "0.875rem", fontWeight: 600, cursor: pdfLoading ? "not-allowed" : "pointer" }}
        >
          <Download size={15} />
          {pdfLoading ? (lang === "es" ? "Generando..." : "Generating...") : (lang === "es" ? "Lista Entrenamiento" : "Training List")}
        </button>
      </div>

      {/* KPI Cards */}
      {kpiLoading ? (
        <div style={{ display: "flex", gap: 12 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ flex: 1, height: 80, background: "var(--color-border)", borderRadius: 8 }} />)}
        </div>
      ) : kpis && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: lang === "es" ? "Descansos hoy"   : "Breaks today",   value: kpis.today_breaks,              color: "#0070C0" },
            { label: lang === "es" ? "En el período"   : "In period",      value: kpis.total_breaks,              color: "#0070C0" },
            { label: lang === "es" ? "Duración prom."  : "Avg duration",   value: `${kpis.avg_duration_min} min`, color: "#6366f1" },
            { label: lang === "es" ? "Activos ahora"   : "Active now",     value: kpis.active_now,                color: "#FFAA00" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, minWidth: 130, padding: "12px 16px",
              background: "var(--color-surface)", border: "1px solid var(--color-border)",
              borderLeft: `4px solid ${color}`, borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>{label}</p>
              <p style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 280, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "1rem" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {lang === "es" ? "Descansos por día" : "Breaks per day"}
          </p>
          {dailyLoading ? <div style={{ height: 200, background: "var(--color-border)", borderRadius: 4 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily?.data || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="break_date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, lang === "es" ? "Descansos" : "Breaks"]} />
                <Bar dataKey="total_breaks" fill="#0070C0" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 220, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "1rem" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {lang === "es" ? "Por turno" : "By shift"}
          </p>
          {turnoLoading ? <div style={{ height: 200, background: "var(--color-border)", borderRadius: 4 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={turnoD?.data || []} dataKey="total" nameKey="turno" cx="50%" cy="50%" outerRadius={70}
                  label={({ turno: t, percent }: any) => `T${t}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {(turnoD?.data || []).map((e: any) => (
                    <Cell key={e.turno} fill={TURNO_COLORS[e.turno] || "#888"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, lang === "es" ? "Descansos" : "Breaks"]} />
                <Legend formatter={(v) => `Turno ${v}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ flex: 2, minWidth: 280, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "1rem" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {lang === "es" ? "Duración promedio por día (min)" : "Avg duration per day (min)"}
          </p>
          {dailyLoading ? <div style={{ height: 200, background: "var(--color-border)", borderRadius: 4 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={daily?.data || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="break_date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v} min`, lang === "es" ? "Promedio" : "Average"]} />
                <Line type="monotone" dataKey="avg_duration" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Breaks table */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {lang === "es" ? "Registro de descansos" : "Break records"}
            {breaks && <span style={{ color: "var(--color-text-secondary)", fontWeight: 400, marginLeft: 8 }}>({breaks.total})</span>}
          </p>
          <input type="text" placeholder={lang === "es" ? "Buscar empleado..." : "Search employee..."} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", fontSize: "0.8125rem", background: "var(--color-surface)", color: "var(--color-text-primary)", width: 200 }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                {(lang === "es"
                  ? ["Fecha", "Entrada", "Salida", "Empleado", "Código", "Turno", "Silla #", "Duración", "Liberado"]
                  : ["Date",  "In",      "Out",    "Employee", "Code",  "Shift", "Chair #", "Duration", "Released"]
                ).map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "var(--color-text-secondary)", borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brksLoading
                ? [1,2,3].map(i => (
                    <tr key={i}>{[1,2,3,4,5,6,7,8,9].map(j => (
                      <td key={j} style={{ padding: "8px 10px" }}><div style={{ height: 12, background: "var(--color-border)", borderRadius: 4 }} /></td>
                    ))}</tr>
                  ))
                : !breaks?.results?.length
                  ? <tr><td colSpan={9} style={{ padding: 30, textAlign: "center", color: "var(--color-text-tertiary)" }}>{lang === "es" ? "Sin registros" : "No records"}</td></tr>
                  : breaks.results.map((r: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{r.break_date}</td>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{r.check_in ? new Date(r.check_in).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{r.check_out ? new Date(r.check_out).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                      <td style={{ padding: "7px 10px" }}>{r.employee_name}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{r.barcode_id}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>
                        <span style={{ background: r.turno === "A" ? "rgba(0,112,192,0.1)" : "rgba(0,176,80,0.1)", color: r.turno === "A" ? "#0070C0" : "#00B050", borderRadius: 4, padding: "1px 6px", fontSize: "0.75rem", fontWeight: 700 }}>{r.turno}</span>
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>{r.chair_number}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>{r.duration_min} min</td>
                      <td style={{ padding: "7px 10px" }}>
                        <span style={{ color: r.released_by === "Auto" ? "#00B050" : "#0070C0", fontWeight: 600 }}>{r.released_by}</span>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {breaks && breaks.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
              style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "5px 12px", background: "var(--color-surface)", cursor: "pointer", fontSize: "0.8125rem" }}>‹</button>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", alignSelf: "center" }}>{page} / {breaks.pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= breaks.pages}
              style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "5px 12px", background: "var(--color-surface)", cursor: "pointer", fontSize: "0.8125rem" }}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}
