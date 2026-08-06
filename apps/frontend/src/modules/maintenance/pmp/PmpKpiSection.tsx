import { useTranslation } from "react-i18next";
import { PM, PmpBuCount, PmpYearStats, buColor, buKey } from "./types";

interface Props {
  monthTotal: number;
  yearTotal:  number;
  year:       number;
  complete:   number;
  open:       number;
  hold:       number;
  cancelled:  number;
  fleets:     PmpBuCount[];
  yearStats:  PmpYearStats | null;
}

interface Breakdown {
  active:    number;
  complete:  number;
  hold:      number;
  open:      number;
  cancelled: number;
}

// Piso comun de altura para las cuatro cards. El grid iguala el resto:
// la fila crece si algun contenido lo exige, pero nunca se ve escalonada.
const CARD_MIN_HEIGHT = "10.5rem";

const panel: React.CSSProperties = {
  border:       "1px solid var(--color-border)",
  background:   "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  padding:      "1rem",
  minHeight:    CARD_MIN_HEIGHT,
  boxSizing:    "border-box",
};

const label: React.CSSProperties = {
  fontSize:      "0.6875rem",
  fontWeight:    600,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color:         "var(--color-text-secondary)",
};

const num: React.CSSProperties = {
  fontFamily: PM.mono, fontWeight: 600,
  color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums",
};

const micro: React.CSSProperties = {
  fontSize: "0.6875rem", color: "var(--color-text-secondary)",
};

/**
 * Mes y anio comparten card apilados: son la misma magnitud (PM programados
 * por due_date) en dos ventanas. El anio va arriba como cifra dominante --
 * es el marco del plan; el mes es el corte dentro de ese marco.
 */
function TotalsCard({ monthTotal, yearTotal, year }: {
  monthTotal: number; yearTotal: number; year: number;
}) {
  const { t } = useTranslation();

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.75rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <span style={label}>{t("pmp.kpis.totalYear", { year })}</span>
        <span style={{ ...num, fontSize: "1.375rem", lineHeight: 1 }}>
          {yearTotal.toLocaleString()}
        </span>
        <span style={micro}>{t("pmp.kpis.fullYear")}</span>
      </div>

      <div style={{ height: 1, background: "var(--color-border)" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <span style={label}>{t("pmp.kpis.totalMonth")}</span>
        <span style={{ ...num, fontSize: "1.125rem", lineHeight: 1 }}>
          {monthTotal.toLocaleString()}
        </span>
        <span style={micro}>{t("pmp.kpis.byDueDate")}</span>
      </div>
    </div>
  );
}

function Counter({ color, value, text }: { color: string; value: number; text: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      <span style={num}>{value}</span>
      <span style={{ color: "var(--color-text-secondary)" }}>{text}</span>
    </span>
  );
}

/**
 * Medidor de avance reutilizado por mes y por anio. El porcentaje se deriva
 * SIEMPRE de breakdown.active (total menos cancelados) para que ambas
 * tarjetas compartan denominador; no recibe un pct precalculado.
 */
function ProgressPanel({ title, breakdown, note }: {
  title:     string;
  breakdown: Breakdown;
  note?:     React.ReactNode;
}) {
  const { t } = useTranslation();
  const { active, complete, hold, open, cancelled } = breakdown;

  const pct          = active > 0 ? Math.round((complete / active) * 100) : null;
  const completeFrac = active > 0 ? (complete / active) * 100 : 0;
  const holdFrac     = active > 0 ? (hold     / active) * 100 : 0;

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
        <span style={label}>{title}</span>
        <span style={{ ...num, fontSize: "0.875rem" }}>{pct != null ? `${pct}%` : "—"}</span>
      </div>

      <div>
        <div style={{
          display: "flex", height: 10, width: "100%", overflow: "hidden",
          borderRadius: 999, background: "var(--color-border)",
        }}>
          <div style={{ height: "100%", background: PM.success, width: `${completeFrac}%` }} />
          <div style={{ height: "100%", background: PM.hold,    width: `${holdFrac}%` }} />
        </div>
        <div style={{ ...micro, marginTop: "0.35rem" }}>
          {t("pmp.kpis.activeBase", { count: active })}
        </div>
        {note && <div style={{ ...micro, marginTop: "0.25rem" }}>{note}</div>}
      </div>

      <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", flexWrap: "wrap" }}>
        <Counter color={PM.success}          value={complete}  text={t("pmp.status.complete")} />
        <Counter color={PM.hold}             value={hold}      text={t("pmp.status.hold")} />
        <Counter color="var(--color-border)" value={open}      text={t("pmp.status.open")} />
        <Counter color="transparent"         value={cancelled} text={t("pmp.status.cancelled")} />
      </div>
    </div>
  );
}

export default function PmpKpiSection({
  monthTotal, yearTotal, year, complete, open, hold, cancelled, fleets, yearStats,
}: Props) {
  const { t } = useTranslation();

  // Los cancelados no cuentan como trabajo pendiente ni como incumplimiento:
  // se excluyen del denominador para que la tasa refleje solo PM vigentes.
  const monthBreakdown: Breakdown = {
    active: monthTotal - cancelled, complete, hold, open, cancelled,
  };

  const yearBreakdown: Breakdown | null = yearStats && {
    active:    yearStats.active,
    complete:  yearStats.complete,
    hold:      yearStats.hold,
    open:      yearStats.open,
    cancelled: yearStats.cancelled,
  };

  const fleetMax = Math.max(1, ...fleets.map((f) => f.count));

  const yearNote = yearStats && (
    <>
      {yearStats.ytd_pct != null
        ? `${t("pmp.kpis.ytdCompliance")} ${yearStats.ytd_pct}%`
        : t("pmp.kpis.noDue")}
      {yearStats.overdue > 0 && (
        <span style={{ color: PM.danger, fontWeight: 700 }}>
          {" · "}{t("pmp.kpis.overdue", { count: yearStats.overdue })}
        </span>
      )}
    </>
  );

  return (
    <section style={{
      display: "grid", gap: "1rem",
      gridTemplateColumns: "13rem repeat(auto-fit, minmax(280px, 1fr))",
    }}>
      <TotalsCard monthTotal={monthTotal} yearTotal={yearTotal} year={year} />

      {yearBreakdown ? (
        <ProgressPanel
          title={t("pmp.kpis.yearCompletion")}
          breakdown={yearBreakdown}
          note={yearNote}
        />
      ) : (
        <div style={{ ...panel, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span style={label}>{t("pmp.kpis.yearCompletion")}</span>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
            {t("pmp.noData")}
          </span>
        </div>
      )}

      <ProgressPanel
        title={t("pmp.kpis.monthCompletion")}
        breakdown={monthBreakdown}
      />

      <div style={{ ...panel, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span style={label}>{t("pmp.kpis.byClient")}</span>
        {fleets.length === 0 ? (
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
            {t("pmp.noData")}
          </span>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {fleets.map((f) => (
              <li key={f.bu} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{
                  width: "5.5rem", flexShrink: 0, fontSize: "0.75rem",
                  color: "var(--color-text-secondary)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {t(`pmp.bu.${buKey(f.bu)}`, { defaultValue: f.bu })}
                </span>
                <span style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" }}>
                  <span style={{
                    display: "block", height: "100%", borderRadius: 999,
                    background: buColor(f.bu), width: `${(f.count / fleetMax) * 100}%`,
                  }} />
                </span>
                <span style={{ ...num, width: "2rem", textAlign: "right", fontSize: "0.75rem" }}>{f.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}