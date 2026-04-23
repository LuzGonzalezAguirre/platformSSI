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

// ─── Donut helper ─────────────────────────────────────────────────────────────
function DonutChart({ items, getLabel, getColor, lang }: {
  items:    { label: string; value: number }[];
  getLabel: (label: string) => string;
  getColor: (label: string, i: number) => string;
  lang:     string;
}) {
  const l     = lang === "es";
  const total = items.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div style={{ textAlign: "center", padding: "1rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
      {l ? "Sin datos" : "No data"}
    </div>
  );

  const size = 140; const cx = 70; const cy = 70; const r = 52; const stroke = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = items.map((item, i) => {
    const dash = circ * (item.value / total);
    const arc  = { ...item, dash, offset, color: getColor(item.label, i) };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
      <svg width={size} height={size} style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        {arcs.map((arc) => (
          <circle key={arc.label} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
            strokeDashoffset={-arc.offset}
            style={{ transition: "stroke-dasharray 0.4s" }}
          />
        ))}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, minWidth: 0 }}>
        {arcs.map((arc) => {
          const pct = ((arc.value / total) * 100).toFixed(1);
          const isCount = Number.isInteger(arc.value) && arc.label.includes("d");
          return (
            <div key={arc.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: arc.color, flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {getLabel(arc.label)}
              </span>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: arc.color, whiteSpace: "nowrap" }}>
                {isCount ? arc.value : `${arc.value.toFixed(1)}h`} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Maintenance Hours by Type — pastel ───────────────────────────────────────
function HoursByType({ byType, lang }: { byType: GroupedItem[]; lang: string }) {
  const l = lang === "es";
  const TYPE_COLOR: Record<string, string> = {
    "preventive":   "#10b981",
    "preventative": "#10b981",
    "changeover":   "#3b82f6",
    "setup":        "#3b82f6",
    "unplanned":    "#ef4444",
    "corrective":   "#ef4444",
    "automation":   "#8b5cf6",
    "production":   "#f59e0b",
  };
  const PALETTE = ["#10b981","#3b82f6","#ef4444","#8b5cf6","#f59e0b","#06b6d4","#f97316","#6b7280"];
  function typeColor(label: string, i: number): string {
    const key = label.toLowerCase();
    return Object.entries(TYPE_COLOR).find(([k]) => key.includes(k))?.[1] ?? PALETTE[i % PALETTE.length];
  }
  const items = byType.map((d) => ({ label: d.label || (l ? "Sin tipo" : "No type"), value: d.hours }));

  return (
    <div style={card}>
      <div style={{ ...sectionTitle, marginBottom: "1rem" }}>
        {l ? "Horas de Mantenimiento por Tipo" : "Maintenance Hours by Type"}
      </div>
      <DonutChart items={items} getLabel={(lbl) => lbl} getColor={typeColor} lang={lang} />
    </div>
  );
}

// ─── Open WR Age Distribution — pastel ───────────────────────────────────────
function WRAgeChart({ rows, lang }: {
  rows: { request_date: string; completed_date: string | null; status: string }[];
  lang: string;
}) {
  const l     = lang === "es";
  const today = new Date();
  const BUCKETS = [
    { label: "0–7d",  min: 0,  max: 7        },
    { label: "8–14d", min: 8,  max: 14       },
    { label: "15–30d",min: 15, max: 30       },
    { label: "31–60d",min: 31, max: 60       },
    { label: ">60d",  min: 61, max: Infinity },
  ];
  const COLORS = ["#10b981","#3b82f6","#f59e0b","#f97316","#ef4444"];
  const pending = rows.filter((r) => !r.completed_date || !r.status.toLowerCase().includes("complet"));
  const items   = BUCKETS.map(({ label, min, max }, i) => ({
    label,
    value: pending.filter((r) => {
      const days = Math.floor((today.getTime() - new Date(r.request_date).getTime()) / 86400000);
      return days >= min && days <= max;
    }).length,
    color: COLORS[i],
  })).filter((d) => d.value > 0);

  return (
    <div style={card}>
      <div style={{ ...sectionTitle, marginBottom: "1rem" }}>
        {l ? "Antigüedad de WRs Abiertos" : "Open WR Age Distribution"}
      </div>
      <DonutChart
        items={items}
        getLabel={(lbl) => lbl}
        getColor={(_, i) => COLORS[i % COLORS.length]}
        lang={lang}
      />
    </div>
  );
}

// ─── Top Failure + Top Equipment — barras verticales ─────────────────────────
function TopChartsSection({ byFailure, byEquipment, rows, lang }: {
  byFailure:   GroupedItem[];
  byEquipment: GroupedItem[];
  rows:        { equipment_id: string; equipment_description: string; maintenance_hours: number }[];
  lang:        string;
}) {
  const l = lang === "es";
  const eqMap = new Map<string, string>();
  rows.forEach((r) => { if (r.equipment_id) eqMap.set(r.equipment_id, r.equipment_description || r.equipment_id); });

  const topFailure = byFailure.slice(0, 8);
  const topEq      = byEquipment.slice(0, 8);

  function VerticalBarChart({ items, getLabel, color }: {
    items:    GroupedItem[];
    getLabel: (item: GroupedItem) => string;
    color:    string;
  }) {
    const maxH   = Math.max(...items.map((d) => d.hours), 1);
    const w = 500; const h = 200;
    const padL = 32; const padR = 8; const padT = 24; const padB = 52;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const colW   = chartW / items.length;
    const barW   = Math.max(8, colW - 8);
    const toX    = (i: number) => padL + (i + 0.5) * colW;
    const toY    = (v: number) => padT + chartH - (v / maxH) * chartH;

    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        {[0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padT + chartH - pct * chartH;
          return (
            <g key={pct}>
              <line x1={padL} x2={padL + chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={7} fill="var(--color-text-secondary)">
                {(maxH * pct).toFixed(0)}h
              </text>
            </g>
          );
        })}
        {items.map((item, i) => {
          const bh    = (item.hours / maxH) * chartH;
          const x     = toX(i);
          const y     = toY(item.hours);
          const lbl   = getLabel(item);
          const words = lbl.split(" ");
          const line1 = words.slice(0, 2).join(" ");
          const line2 = words.slice(2, 4).join(" ");
          return (
            <g key={item.label}>
              <rect x={x - barW / 2} y={y} width={barW} height={bh} fill={color} opacity={0.75} rx={3} />
              <text x={x} y={y - 4} textAnchor="middle" fontSize={8} fill={color} fontWeight="700">
                {item.hours.toFixed(1)}h
              </text>
              <text x={x} y={padT + chartH + 13} textAnchor="middle" fontSize={7} fill="var(--color-text-secondary)">{line1}</text>
              {line2 && <text x={x} y={padT + chartH + 23} textAnchor="middle" fontSize={7} fill="var(--color-text-secondary)">{line2}</text>}
            </g>
          );
        })}
        <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: "1rem" }}>
          {l ? "Top Tipos de Falla — Horas" : "Top Failure Types by Hours"}
        </div>
        {topFailure.length === 0
          ? <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", textAlign: "center", padding: "1rem" }}>{l ? "Sin datos" : "No data"}</div>
          : <VerticalBarChart items={topFailure} getLabel={(item) => item.label && item.label !== "—" ? item.label : "Unknown"} color="#6b7280" />
        }
      </div>
      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: "1rem" }}>
          {l ? "Top 8 Equipos — Horas" : "Top 8 Equipment by Maintenance Hours"}
        </div>
        {topEq.length === 0
          ? <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", textAlign: "center", padding: "1rem" }}>{l ? "Sin datos" : "No data"}</div>
          : <VerticalBarChart items={topEq} getLabel={(item) => eqMap.get(item.label) || item.label || "Unknown"} color="#3b82f6" />
        }
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

  const toX  = (i: number) => padL + (i / byDay.length) * chartW + barW / 2;
  const toYH = (v: number) => padT + chartH - (v / maxH) * chartH;
  const toYC = (v: number) => padT + chartH - (v / maxC) * chartH;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            {l ? "Mantenimiento — Work Requests" : "Work Requests"}
          </h1>
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

          {/* 2 — Pie charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <HoursByType byType={data.by_type} lang={lang} />
            <WRAgeChart rows={data.rows as any} lang={lang} />
          </div>

          {/* 3 — Bar charts */}
          <TopChartsSection
            byFailure={data.by_failure}
            byEquipment={data.by_equipment}
            rows={data.rows as any}
            lang={lang}
          />

          {/* 4 — Equipment load */}
          <EquipmentBubbleGrid data={data.equipment_grid} lang={lang} />

          {/* 5 — Tendencia diaria */}
          <TrendMini byDay={data.by_day} lang={lang} />

          {/* 6 — Fallas + Técnicos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <FailureBreakdown byFailure={data.by_failure} byType={data.by_type} byAction={byAction} lang={lang} />
            <TechnicianChart data={data.by_technician} lang={lang} />
          </div>

          {/* 7 — Tabla */}
          <WRTable rows={data.rows} lang={lang} />
        </>
      )}
    </div>
  );
}