import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkRequestsData } from "./useWorkRequestsData";
import { DateRange, GroupedItem } from "./types";
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

// ─── Top Failure Types + Top Equipment (gráficas de barras horizontales) ──────
function TopChartsSection({ byFailure, byEquipment, rows, lang }: {
  byFailure:   GroupedItem[];
  byEquipment: GroupedItem[];
  rows:        { equipment_id: string; equipment_description: string; status: string; maintenance_hours: number }[];
  lang:        string;
}) {
  const l = lang === "es";

  // Enriquecer byEquipment con la descripción real del equipo
  const eqMap = new Map<string, string>();
  rows.forEach((r) => { if (r.equipment_id) eqMap.set(r.equipment_id, r.equipment_description || r.equipment_id); });

  // Detectar overdue por equipo (si alguna WR tiene due_date pasada y no completed)
  const overdueEq = new Set<string>();
  (rows as any[]).forEach((r) => {
    if (!r.completed_date && r.due_date && new Date(r.due_date) < new Date()) overdueEq.add(r.equipment_id);
  });

  const topFailure = byFailure.slice(0, 8);
  const topEq      = byEquipment.slice(0, 8);
  const maxFH      = Math.max(...topFailure.map((d) => d.hours), 1);
  const maxEH      = Math.max(...topEq.map((d) => d.hours), 1);

  function HBarChart({ items, maxVal, getLabel, getColor }: {
    items:    GroupedItem[];
    maxVal:   number;
    getLabel: (item: GroupedItem) => string;
    getColor: (item: GroupedItem) => string;
  }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {items.map((item) => {
          const pct = (item.hours / maxVal) * 100;
          const col = getColor(item);
          return (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "1fr 80px 48px", gap: "0.5rem", alignItems: "center" }}>
              <div style={{ fontSize: "0.775rem", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={getLabel(item)}>
                {getLabel(item)}
              </div>
              <div style={{ position: "relative", height: 18, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: `${pct}%`, height: "100%", background: col, borderRadius: 3, transition: "width 0.3s ease" }} />
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: col, textAlign: "right", whiteSpace: "nowrap" }}>
                {item.hours.toFixed(1)} h
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      {/* Top Failure Types */}
      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: "1rem" }}>
          {l ? "Top Tipos de Falla — Horas" : "Top Failure Types by Maintenance Hours"}
        </div>
        <HBarChart
          items={topFailure}
          maxVal={maxFH}
          getLabel={(item) => item.label || (l ? "Sin especificar" : "Unspecified")}
          getColor={() => "#6b7280"}
        />
        {topFailure.length === 0 && (
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", textAlign: "center", padding: "1rem" }}>
            {l ? "Sin datos" : "No data"}
          </div>
        )}
      </div>

      {/* Top Equipment */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.5rem" }}>
          <div style={sectionTitle}>{l ? "Top Equipos — Horas de Mantenimiento" : "Top Equipment by Total Maintenance Hours"}</div>
          <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.7rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "#6b7280", borderRadius: 2 }} />
              {l ? "Normal" : "None"}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "#ef4444", borderRadius: 2 }} />
              {l ? "Vencida" : "Overdue"}
            </span>
          </div>
        </div>
        <HBarChart
          items={topEq}
          maxVal={maxEH}
          getLabel={(item) => eqMap.get(item.label) || item.label}
          getColor={(item) => overdueEq.has(item.label) ? "#ef4444" : "#6b7280"}
        />
        {topEq.length === 0 && (
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", textAlign: "center", padding: "1rem" }}>
            {l ? "Sin datos" : "No data"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Trend diaria ─────────────────────────────────────────────────────────────
function TrendMini({ byDay, lang }: { byDay: { date: string; count: number; hours: number }[]; lang: string }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (byDay.length === 0) return null;

  const l      = lang === "es";
  const w      = 700; const h = 160;
  const padL   = 44;  const padR = 16; const padT = 20; const padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxH   = Math.max(...byDay.map((d) => d.hours), 1);
  const maxC   = Math.max(...byDay.map((d) => d.count), 1);
  const avgH   = byDay.reduce((s, d) => s + d.hours, 0) / byDay.length;
  const peakHi = byDay.reduce((best, d, i) => d.hours > byDay[best].hours ? i : best, 0);
  const barW   = Math.max(4, (chartW / byDay.length) - 2);

  function toX(i: number)  { return padL + (i / byDay.length) * chartW + barW / 2; }
  function toYH(v: number) { return padT + chartH - (v / maxH) * chartH; }
  function toYC(v: number) { return padT + chartH - (v / maxC) * chartH; }

  const lineC = byDay.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toYC(d.count).toFixed(1)}`).join(" ");
  const areaH = [
    `M${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)}`,
    ...byDay.map((d, i) => `L${toX(i).toFixed(1)},${toYH(d.hours).toFixed(1)}`),
    `L${toX(byDay.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)}`,
    "Z",
  ].join(" ");

  const avgY    = toYH(avgH);
  const step    = Math.max(1, Math.ceil(byDay.length / 10));
  const hovItem = hovered !== null ? byDay[hovered] : null;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={sectionTitle}>{l ? "Tendencia Diaria" : "Daily Trend"}</div>
        <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <svg width="18" height="8"><rect x="0" y="2" width="18" height="6" rx="2" fill="#3b82f640" /></svg>
            {l ? "Horas" : "Hours"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <svg width="18" height="8"><path d="M0,4 L18,4" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,2" /></svg>
            {l ? "Cant. WR" : "WR Count"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <svg width="18" height="8"><path d="M0,4 L18,4" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,3" /></svg>
            {l ? "Promedio hrs" : "Avg hours"}
          </span>
        </div>
      </div>

      {hovItem && (
        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.78rem", marginBottom: "0.5rem", padding: "0.4rem 0.75rem", background: "var(--color-border)", borderRadius: "var(--radius-md)", width: "fit-content" }}>
          <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{hovItem.date}</span>
          <span style={{ color: "#3b82f6", fontWeight: 600 }}>{hovItem.hours.toFixed(1)} h</span>
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{hovItem.count} WR</span>
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="gradH" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padT + chartH - pct * chartH;
          return (
            <g key={pct}>
              <line x1={padL} x2={padL + chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">{(maxH * pct).toFixed(0)}</text>
            </g>
          );
        })}
        <path d={areaH} fill="url(#gradH)" />
        {byDay.map((d, i) => {
          const bh = (d.hours / maxH) * chartH;
          return <rect key={i} x={toX(i) - barW / 2} y={padT + chartH - bh} width={barW} height={bh} fill="#3b82f6" opacity={hovered === i ? 0.9 : i === peakHi ? 0.75 : 0.45} rx={2} />;
        })}
        <path d={lineC} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" strokeDasharray="5,3" />
        {byDay.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toYC(d.count)} r={hovered === i ? 4 : 2.5} fill="#f59e0b" opacity={hovered === i ? 1 : 0.7} />
        ))}
        <line x1={padL} x2={padL + chartW} y1={avgY} y2={avgY} stroke="#10b981" strokeWidth={1.5} strokeDasharray="4,4" />
        <text x={padL + chartW + 2} y={avgY + 3} fontSize={8} fill="#10b981">{l ? "prom" : "avg"}</text>
        {(() => {
          const px = toX(peakHi); const py = toYH(byDay[peakHi].hours);
          return (
            <g>
              <line x1={px} x2={px} y1={py - 2} y2={py - 16} stroke="#ef4444" strokeWidth={1} strokeDasharray="2,2" />
              <rect x={px - 22} y={py - 30} width={44} height={14} rx={3} fill="#ef444420" stroke="#ef4444" strokeWidth={0.8} />
              <text x={px} y={py - 20} textAnchor="middle" fontSize={8} fill="#ef4444" fontWeight="700">
                {l ? "PICO" : "PEAK"} {byDay[peakHi].hours.toFixed(1)}h
              </text>
            </g>
          );
        })()}
        {byDay.map((_, i) => (
          <rect key={i} x={toX(i) - (chartW / byDay.length) / 2} y={padT} width={chartW / byDay.length} height={chartH} fill="transparent" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
        <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        {byDay.map((d, i) => i % step === 0 ? (
          <text key={i} x={toX(i)} y={padT + chartH + 14} textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">{d.date.slice(5)}</text>
        ) : null)}
      </svg>

      <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-secondary)", borderTop: "1px solid var(--color-border)", paddingTop: "0.5rem" }}>
        <span>{l ? "Promedio diario:" : "Daily avg:"} <strong style={{ color: "var(--color-text-primary)" }}>{avgH.toFixed(1)} h</strong></span>
        <span>{l ? "Pico:" : "Peak:"} <strong style={{ color: "#ef4444" }}>{byDay[peakHi]?.date} — {byDay[peakHi]?.hours.toFixed(1)} h</strong></span>
        <span>{l ? "Total WR:" : "Total WR:"} <strong style={{ color: "var(--color-text-primary)" }}>{byDay.reduce((s, d) => s + d.count, 0)}</strong></span>
      </div>
    </div>
  );
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const card: React.CSSProperties         = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" };
const dateInput: React.CSSProperties    = { padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: "0.875rem" };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WorkRequestsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const [range, setRange] = useState<DateRange>(getDefaultRange());
  const { data, loading, error } = useWorkRequestsData(range);

  const l = lang === "es";

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
          <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} style={dateInput} />
          <label style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{l ? "Hasta:" : "To:"}</label>
          <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} style={dateInput} />
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "var(--radius-md)", color: "#ef4444", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
          {l ? "Cargando Work Requests..." : "Loading Work Requests..."}
        </div>
      ) : data && (
        <>
          {/* 1 — KPIs */}
          <WRKpiSection kpis={data.kpis} lang={lang} />

          {/* 2 — Top Failure Types + Top Equipment (nuevas gráficas) */}
          <TopChartsSection
            byFailure={data.by_failure}
            byEquipment={data.by_equipment}
            rows={data.rows as any}
            lang={lang}
          />

          {/* 3 — Equipment load */}
          <EquipmentBubbleGrid data={data.equipment_grid} lang={lang} />

          {/* 4 — Tendencia diaria */}
          <TrendMini byDay={data.by_day} lang={lang} />

          {/* 5 — Fallas + Técnicos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <FailureBreakdown byFailure={data.by_failure} byType={data.by_type} byAction={byAction} lang={lang} />
            <TechnicianChart data={data.by_technician} lang={lang} />
          </div>

          {/* 6 — Tabla detallada por type */}
          <WRTable rows={data.rows} lang={lang} />
        </>
      )}
    </div>
  );
}