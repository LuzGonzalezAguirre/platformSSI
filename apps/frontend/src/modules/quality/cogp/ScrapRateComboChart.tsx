import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrapRateWeek } from "../services/cogp.service";

interface ScrapRateComboChartProps {
  weeks: ScrapRateWeek[];
  /** Meta de scrap rate en %. Sin confirmar con Calidad: si no se pasa,
   *  no se dibuja linea de meta en lugar de inventar un umbral. */
  targetPct?: number;
  height?: number;
}

const COLOR_PRODUCED = "#3b82f6";
const COLOR_SCRAP = "#f97316";
const COLOR_LINE = "#6b7280";
const COLOR_TARGET = "#ef4444";
const COLOR_HIGHLIGHT = "#fde047";

/** Altura minima en px del segmento de scrap cuando scrap > 0. A 14 piezas
 *  contra 4500 el segmento real mide 0.3px y es invisible: este piso
 *  comunica PRESENCIA, no magnitud. La magnitud va en la etiqueta numerica
 *  y en la linea de %. Con scrap = 0 el piso NO aplica -- pintar scrap
 *  donde no hubo destruiria la credibilidad del chart. */
const MIN_SCRAP_PX = 3;

const W = 1600;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const n = value / base;
  const step =
    n <= 1 ? 1 : n <= 1.2 ? 1.2 : n <= 1.5 ? 1.5 : n <= 2 ? 2
    : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5
    : n <= 6 ? 6 : n <= 8 ? 8 : 10;
  return step * base;
}

function fmtQty(v: number): string {
  return v.toLocaleString("en-US");
}

function fmtPct(v: string | null): string {
  return v === null ? "—" : `${parseFloat(v).toFixed(2)}%`;
}

export default function ScrapRateComboChart({
  weeks,
  targetPct,
  height = 560,
}: ScrapRateComboChartProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);

  if (weeks.length === 0) {
    return (
      <div style={{ padding: "4rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
        {t("scrapRate.noData")}
      </div>
    );
  }

  const H = height;
  const PAD = { top: 56, right: 86, bottom: 108, left: 82 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + innerH;

  const n = weeks.length;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.6, 40);

  const maxQty = niceMax(Math.max(...weeks.map((w) => w.input_qty), 1));
  const rates = weeks
    .map((w) => (w.scrap_rate_pct !== null ? parseFloat(w.scrap_rate_pct) : null))
    .filter((v): v is number => v !== null);
  const maxPct = niceMax(Math.max(...rates, targetPct ?? 0, 0.5) * 1.2);

  const xCenter = (i: number) => PAD.left + slot * (i + 0.5);
  const yQty = (v: number) => baseline - (v / maxQty) * innerH;
  const yPct = (v: number) => baseline - (v / maxPct) * innerH;

  // Etiquetas numericas solo si hay espacio real; con 52 semanas se
  // encimarian y el chart se vuelve ilegible.
  const showValueLabels = n <= 32;
  const labelEvery = Math.ceil(n / 32);

  // La linea se corta en semanas sin input: un rate indefinido no se
  // interpola ni se baja a cero.
  const lineSegments: { i: number; x: number; y: number; pct: number }[][] = [];
  let current: { i: number; x: number; y: number; pct: number }[] = [];
  weeks.forEach((w, i) => {
    if (w.scrap_rate_pct !== null) {
      const pct = parseFloat(w.scrap_rate_pct);
      current.push({ i, x: xCenter(i), y: yPct(pct), pct });
    } else if (current.length > 0) {
      lineSegments.push(current);
      current = [];
    }
  });
  if (current.length > 0) lineSegments.push(current);

  const lastWithData = [...weeks].reverse().find((w) => w.scrap_rate_pct !== null);
  const lastIdx = lastWithData ? weeks.indexOf(lastWithData) : -1;

  const hoveredWeek = hover !== null ? weeks[hover] : null;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        {/* grid + eje izquierdo (cantidad) + eje derecho (%) */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = baseline - f * innerH;
          return (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={0.75} />
              <text x={PAD.left - 10} y={y + 4} textAnchor="end" fontSize={12} fill="var(--color-text-secondary)">
                {fmtQty(Math.round(maxQty * f))}
              </text>
              <text x={W - PAD.right + 10} y={y + 4} textAnchor="start" fontSize={12} fill="var(--color-text-secondary)">
                {(maxPct * f).toFixed(2)}%
              </text>
            </g>
          );
        })}

        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={baseline} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={W - PAD.right} x2={W - PAD.right} y1={PAD.top} y2={baseline} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} stroke="var(--color-border)" strokeWidth={1.5} />

        {targetPct !== undefined && (
          <g>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={yPct(targetPct)} y2={yPct(targetPct)}
              stroke={COLOR_TARGET} strokeWidth={1.25} strokeDasharray="6 4"
            />
            <text
              x={W - PAD.right - 6} y={yPct(targetPct) - 6}
              textAnchor="end" fontSize={12} fontWeight={700} fill={COLOR_TARGET}
            >
              {targetPct.toFixed(2)}% {t("scrapRate.target")}
            </text>
          </g>
        )}

        {/* zonas de hover, una por semana, transparentes */}
        {weeks.map((w, i) => (
          <rect
            key={`hit-${w.label}`}
            x={PAD.left + slot * i} y={PAD.top}
            width={slot} height={innerH}
            fill={hover === i ? "var(--color-border)" : "transparent"}
            opacity={hover === i ? 0.25 : 0}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          />
        ))}

        {/* barras apiladas: producido abajo, scrap arriba. El total es el
            input, asi que la fraccion naranja ES el scrap rate. */}
        {weeks.map((w, i) => {
          if (w.is_future || w.input_qty === 0) return null;

          const x = xCenter(i) - barW / 2;
          const producedH = (w.produced_qty / maxQty) * innerH;
          const scrapH = w.scrap_qty > 0
            ? Math.max((w.scrap_qty / maxQty) * innerH, MIN_SCRAP_PX)
            : 0;
          const yProduced = baseline - producedH;
          const yScrap = yProduced - scrapH;
          const partial = w.is_partial;

          return (
            <g key={`bar-${w.label}`} opacity={partial ? 0.7 : 1} pointerEvents="none">
              <rect
                x={x} y={yProduced} width={barW} height={Math.max(producedH, 0)}
                fill={COLOR_PRODUCED}
                stroke={partial ? COLOR_PRODUCED : "none"}
                strokeDasharray={partial ? "3 2" : undefined}
              />
              {scrapH > 0 && (
                <rect x={x} y={yScrap} width={barW} height={scrapH} fill={COLOR_SCRAP} />
              )}

              {showValueLabels && (
                <>
                  <text
                    x={xCenter(i)} y={yScrap - 7}
                    textAnchor="middle" fontSize={11} fontWeight={700}
                    fill="var(--color-text-primary)"
                  >
                    {fmtQty(w.input_qty)}
                  </text>
                  <text
                    x={xCenter(i)} y={baseline + 15}
                    textAnchor="middle" fontSize={10} fontWeight={700} fill={COLOR_SCRAP}
                  >
                    {fmtQty(w.scrap_qty)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* linea de scrap rate */}
        {lineSegments.map((seg, si) => (
          <polyline
            key={`seg-${si}`}
            points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none" stroke={COLOR_LINE} strokeWidth={2} strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}

        {lineSegments.flat().map((p) => {
          const isLast = p.i === lastIdx;
          const isHov = hover === p.i;
          return (
            <g key={`pt-${p.i}`} pointerEvents="none">
              <circle
                cx={p.x} cy={p.y} r={isHov ? 5.5 : isLast ? 4.5 : 3}
                fill={isLast ? COLOR_TARGET : COLOR_LINE}
                stroke="var(--color-surface)" strokeWidth={1.5}
              />
              {(showValueLabels || isLast || isHov) && (
                <>
                  {isLast && (
                    <rect
                      x={p.x - 27} y={p.y - 26} width={54} height={17} rx={2}
                      fill={COLOR_HIGHLIGHT}
                    />
                  )}
                  <text
                    x={p.x} y={p.y - 14}
                    textAnchor="middle" fontSize={11} fontWeight={isLast ? 800 : 600}
                    fill={isLast ? "#111827" : "var(--color-text-secondary)"}
                  >
                    {p.pct.toFixed(2)}%
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* etiquetas de semana, rotadas como en el reporte original */}
        {weeks.map((w, i) => {
          if (i % labelEvery !== 0 && hover !== i) return null;
          return (
            <text
              key={`lbl-${w.label}`}
              x={xCenter(i)} y={baseline + 34}
              textAnchor="end" fontSize={11}
              fill={w.is_future ? "var(--color-text-secondary)" : "var(--color-text-primary)"}
              opacity={w.is_future ? 0.5 : 1}
              transform={`rotate(-45 ${xCenter(i)} ${baseline + 34})`}
              pointerEvents="none"
            >
              {w.label}
            </text>
          );
        })}

        {/* leyenda */}
        <g transform={`translate(${W / 2 - 300}, ${H - 22})`} pointerEvents="none">
          <rect x={0} y={0} width={14} height={11} fill={COLOR_PRODUCED} />
          <text x={20} y={10} fontSize={12} fill="var(--color-text-secondary)">
            {t("scrapRate.legend.produced")}
          </text>
          <rect x={150} y={0} width={14} height={11} fill={COLOR_SCRAP} />
          <text x={170} y={10} fontSize={12} fill="var(--color-text-secondary)">
            {t("scrapRate.legend.scrap")}
          </text>
          <line x1={300} x2={330} y1={6} y2={6} stroke={COLOR_LINE} strokeWidth={2} />
          <circle cx={315} cy={6} r={3} fill={COLOR_LINE} />
          <text x={338} y={10} fontSize={12} fill="var(--color-text-secondary)">
            {t("scrapRate.legend.rate")}
          </text>
        </g>
      </svg>

      <div style={{ textAlign: "center", fontSize: "0.68rem", color: "var(--color-text-secondary)", marginTop: "-0.25rem" }}>
        {t("scrapRate.legend.scrapNotToScale")}
      </div>

      {hoveredWeek && (
        <div
          style={{
            position: "absolute",
            left: `${(xCenter(hover as number) / W) * 100}%`,
            top: "0.5rem",
            transform:
              (hover as number) > n / 2 ? "translateX(-105%)" : "translateX(5%)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md, 8px)",
            padding: "0.6rem 0.8rem",
            fontSize: "0.75rem",
            color: "var(--color-text-primary)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
            pointerEvents: "none",
            zIndex: 5,
            minWidth: "180px",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: "0.35rem" }}>
            {hoveredWeek.label}
            {hoveredWeek.is_partial && (
              <span style={{ fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.35rem" }}>
                · {t("scrapRate.partialWeek")}
              </span>
            )}
          </div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "0.68rem", marginBottom: "0.4rem" }}>
            {hoveredWeek.week_start} → {hoveredWeek.week_end}
          </div>
          <TooltipRow label={t("scrapRate.tooltip.input")} value={fmtQty(hoveredWeek.input_qty)} />
          <TooltipRow label={t("scrapRate.tooltip.produced")} value={fmtQty(hoveredWeek.produced_qty)} color={COLOR_PRODUCED} />
          <TooltipRow label={t("scrapRate.tooltip.scrap")} value={fmtQty(hoveredWeek.scrap_qty)} color={COLOR_SCRAP} />
          <TooltipRow label={t("scrapRate.tooltip.rate")} value={fmtPct(hoveredWeek.scrap_rate_pct)} bold />
          {hoveredWeek.scrap_qty_finished > 0 && (
            <TooltipRow
              label={t("scrapRate.tooltip.scrapFinished")}
              value={fmtQty(hoveredWeek.scrap_qty_finished)}
            />
          )}
          {!hoveredWeek.has_input && (
            <div style={{ marginTop: "0.35rem", fontSize: "0.68rem", color: "var(--color-text-secondary)", fontStyle: "italic" }}>
              {t("scrapRate.undefinedRate")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TooltipRow({ label, value, color, bold }: {
  label: string; value: string; color?: string; bold?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", lineHeight: 1.6 }}>
      <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, color: color ?? "var(--color-text-primary)" }}>
        {value}
      </span>
    </div>
  );
}