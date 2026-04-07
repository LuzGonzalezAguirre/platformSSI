import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkRequestsData } from "./useWorkRequestsData";
import { DateRange, GroupedItem } from "./types";
import { WRKpis } from "./types";
import WRKpiSection        from "./WRKpiSection";
import EquipmentBubbleGrid from "./EquipmentBubbleGrid";
import FailureBreakdown    from "./FailureBreakdown";
import TechnicianChart     from "./TechnicianChart";
import WRTable             from "./WRTable";

function getDefaultRange(): DateRange {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().split("T")[0],
    end:   now.toISOString().split("T")[0],
  };
}

// Mini trend inline (reutiliza lógica SVG del proyecto)
function TrendMini({ byDay, lang }: { byDay: { date: string; count: number; hours: number }[]; lang: string }) {
  if (byDay.length === 0) return null;
  const w = 600; const h = 120; const padL = 40; const padR = 12; const padT = 16; const padB = 28;
  const chartW = w - padL - padR; const chartH = h - padT - padB;
  const maxH = Math.max(...byDay.map((d) => d.hours), 1);
  const maxC = Math.max(...byDay.map((d) => d.count), 1);
  const step = Math.max(1, Math.ceil(byDay.length / 8));

  function toX(i: number) { return padL + (byDay.length > 1 ? (i / (byDay.length - 1)) * chartW : chartW / 2); }
  function toYH(v: number) { return padT + chartH - (v / maxH) * chartH; }
  function toYC(v: number) { return padT + chartH - (v / maxC) * chartH; }

  const pathH = byDay.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toYH(d.hours).toFixed(1)}`).join(" ");
  const pathC = byDay.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toYC(d.count).toFixed(1)}`).join(" ");

  return (
    <div style={card}>
      <div style={sectionTitle}>{lang === "es" ? "Tendencia Diaria" : "Daily Trend"}</div>
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
        <span><span style={{ color: "#3b82f6", fontWeight: 700 }}>—</span> {lang === "es" ? "Horas" : "Hours"}</span>
        <span><span style={{ color: "#f59e0b", fontWeight: 700 }}>—</span> {lang === "es" ? "Cant. WR" : "WR Count"}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
        <path d={pathH} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
        <path d={pathC} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" strokeDasharray="4,3" />
        {byDay.map((d, i) => i % step === 0 ? (
          <text key={i} x={toX(i)} y={padT + chartH + 14} textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">
            {d.date.slice(5)}
          </text>
        ) : null)}
        <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.75rem" };

export default function WorkRequestsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const [range, setRange] = useState<DateRange>(getDefaultRange());
  const { data, loading, error } = useWorkRequestsData(range);

  const l = lang === "es";

  // Failure action como GroupedItem
  const byAction: GroupedItem[] = data
    ? Object.entries(
        data.rows.reduce((acc: Record<string, GroupedItem>, r) => {
          const k = r.failure_action || "—";
          if (!acc[k]) acc[k] = { label: k, count: 0, hours: 0 };
          acc[k].count++;
          acc[k].hours += r.maintenance_hours;
          return acc;
        }, {})
      ).map(([, v]) => v).sort((a, b) => b.count - a.count)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            {l ? "Mantenimiento — Work Requests" : "Maintenance — Work Requests"}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" }}>Out Tijuana</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{l ? "Desde:" : "From:"}</label>
          <input type="date" value={range.start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            style={dateInput} />
          <label style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{l ? "Hasta:" : "To:"}</label>
          <input type="date" value={range.end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            style={dateInput} />
        </div>
      </div>

      {error && <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" }}>{error}</div>}

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
          {l ? "Cargando Work Requests..." : "Loading Work Requests..."}
        </div>
      ) : data && (
        <>
          {/* 1 — KPIs */}
          <WRKpiSection kpis={data.kpis} lang={lang} />

          {/* 2 — Visual principal */}
          <EquipmentBubbleGrid data={data.equipment_grid} lang={lang} />

          {/* 3 — Tendencia diaria */}
          <TrendMini byDay={data.by_day} lang={lang} />

          {/* 4 — Fallas + Técnicos (2 columnas) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <FailureBreakdown
              byFailure={data.by_failure}
              byType={data.by_type}
              byAction={byAction}
              lang={lang}
            />
            <TechnicianChart data={data.by_technician} lang={lang} />
          </div>

          {/* 5 — Tabla detallada */}
          <WRTable rows={data.rows} lang={lang} />
        </>
      )}
    </div>
  );
}

const dateInput: React.CSSProperties = {
  padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)", background: "var(--color-surface)",
  color: "var(--color-text-primary)", fontSize: "0.875rem",
};