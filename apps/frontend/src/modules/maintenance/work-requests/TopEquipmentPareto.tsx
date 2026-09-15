import { useState } from "react";
import { GroupedItem } from "./types";

interface Props {
  byEquipment: GroupedItem[];
  rows: { equipment_id: string; equipment_description: string; maintenance_hours: number }[];
  lang: string;
}

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "1.25rem",
};

function compactLabel(value: string, max = 18) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export default function TopEquipmentPareto({ byEquipment, rows, lang }: Props) {
  const l = lang === "es";
  const [hovered, setHovered] = useState<number | null>(null);
  const descriptions = new Map<string, string>();
  rows.forEach((row) => {
    if (row.equipment_id) descriptions.set(row.equipment_id, row.equipment_description || row.equipment_id);
  });

  const top = [...byEquipment].sort((a, b) => b.hours - a.hours).slice(0, 8);
  const allEquipmentHours = rows.reduce((sum, row) => sum + (Number(row.maintenance_hours) || 0), 0);
  const denominator = allEquipmentHours > 0 ? allEquipmentHours : top.reduce((sum, item) => sum + item.hours, 0);
  let running = 0;
  const data = top.map((item) => {
    running += item.hours;
    return {
      ...item,
      fullLabel: descriptions.get(item.label) || item.label || (l ? "Sin equipo" : "Unknown equipment"),
      cumulativePct: denominator > 0 ? Math.min((running / denominator) * 100, 100) : 0,
    };
  });

  if (!data.length) {
    return (
      <div style={card}>
        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
          {l ? "Top 8 Equipos — Pareto de Horas" : "Top 8 Equipment by Maintenance Hours — Pareto"}
        </div>
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.8rem" }}>
          {l ? "Sin datos" : "No data"}
        </div>
      </div>
    );
  }

  const W = 760; const H = 270;
  const padL = 46; const padR = 48; const padT = 24; const padB = 62;
  const chartW = W - padL - padR; const chartH = H - padT - padB;
  const maxHours = Math.max(...data.map((d) => d.hours), 1);
  const spacing = chartW / data.length;
  const barW = Math.min(52, spacing * 0.62);
  const cx = (i: number) => padL + spacing * (i + 0.5);
  const yPct = (v: number) => padT + chartH * (1 - v / 100);
  const points = data.map((d, i) => `${cx(i)},${yPct(d.cumulativePct)}`).join(" ");
  const active = hovered === null ? null : data[hovered];

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
          {l ? "Top 8 Equipos — Pareto de Horas" : "Top 8 Equipment by Maintenance Hours — Pareto"}
        </div>
        <div style={{ display: "flex", gap: "1rem", fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>
          <span>■ {l ? "Horas" : "Hours"}</span>
          <span style={{ color: "#f59e0b" }}>● {l ? "% acumulado" : "Cumulative %"}</span>
          <span style={{ color: "#ef4444" }}>-- 80%</span>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        {active && (
          <div style={{ position: "absolute", zIndex: 5, left: `${(cx(hovered as number) / W) * 100}%`, top: 4, transform: "translateX(-50%)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.5rem 0.7rem", boxShadow: "0 4px 14px rgba(0,0,0,.16)", fontSize: "0.72rem", pointerEvents: "none", maxWidth: 280 }}>
            <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>{active.fullLabel}</div>
            <div>{active.hours.toFixed(1)} h · {active.cumulativePct.toFixed(1)}% {l ? "acumulado" : "cumulative"}</div>
          </div>
        )}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
          {[0, .25, .5, .75, 1].map((p) => {
            const y = padT + chartH * (1 - p);
            return <g key={p}><line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.6} /><text x={padL - 6} y={y + 3} textAnchor="end" fontSize={8} fill="var(--color-text-secondary)">{(maxHours * p).toFixed(0)}h</text></g>;
          })}
          <line x1={padL} x2={W - padR} y1={yPct(80)} y2={yPct(80)} stroke="#ef4444" strokeWidth={1.2} strokeDasharray="5,4" />
          <text x={W - padR + 4} y={yPct(80) + 3} fontSize={8} fill="#ef4444">80%</text>
          {[0, 25, 50, 75, 100].map((p) => <text key={p} x={W - padR + 7} y={yPct(p) + 3} fontSize={7} fill="#f59e0b">{p}%</text>)}
          {data.map((d, i) => {
            const h = (d.hours / maxHours) * chartH;
            const x = cx(i);
            return <g key={d.label} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
              <title>{d.fullLabel}</title>
              <rect x={x - barW / 2} y={padT + chartH - h} width={barW} height={h} rx={3} fill="#3b82f6" opacity={hovered === i ? 1 : .78} />
              <text x={x} y={padT + chartH - h - 5} textAnchor="middle" fontSize={8} fontWeight={700} fill="#3b82f6">{d.hours.toFixed(1)}h</text>
              <text x={x} y={padT + chartH + 16} textAnchor="middle" fontSize={7.5} fill="var(--color-text-secondary)">{compactLabel(d.fullLabel)}</text>
            </g>;
          })}
          <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" />
          {data.map((d, i) => <circle key={`p-${d.label}`} cx={cx(i)} cy={yPct(d.cumulativePct)} r={hovered === i ? 4 : 3} fill="#f59e0b" stroke="var(--color-surface)" strokeWidth={1} />)}
        </svg>
      </div>
    </div>
  );
}
