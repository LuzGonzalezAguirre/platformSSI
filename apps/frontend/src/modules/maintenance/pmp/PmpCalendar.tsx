import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DayBucket, PM, dateKey } from "./types";

interface Props {
  year:     number;
  month:    number;
  buckets:  Map<string, DayBucket>;
  selected: string | null;
  today:    string;
  onSelect: (key: string) => void;
  onPrev:   () => void;
  onNext:   () => void;
  onToday:  () => void;
}

const TINT = {
  complete: "rgba(18,135,111,0.10)",
  hold:     "rgba(180,83,9,0.10)",
  pending:  "rgba(224,132,45,0.09)",
};

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
  background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer",
};

/**
 * El color de la celda comunica ESTADO, no volumen. Los cancelados se excluyen
 * del calculo: un dia con 5 PM de los cuales 5 estan cancelados no es un dia
 * pendiente, es un dia sin trabajo real.
 */
function dayTint(b: DayBucket | undefined): string {
  if (!b) return "var(--color-bg)";
  const active = b.total - b.cancelled;
  if (active === 0)          return "var(--color-bg)";
  if (b.hold > 0)            return TINT.hold;
  if (b.complete === active) return TINT.complete;
  return TINT.pending;
}

function tintAccent(b: DayBucket | undefined): string {
  if (!b) return "transparent";
  const active = b.total - b.cancelled;
  if (active === 0)          return "transparent";
  if (b.hold > 0)            return PM.hold;
  if (b.complete === active) return PM.success;
  return PM.accent;
}

export default function PmpCalendar({
  year, month, buckets, selected, today, onSelect, onPrev, onNext, onToday,
}: Props) {
  const { t, i18n } = useTranslation();

  const daysInMonth = new Date(year, month, 0).getDate();
  const leading     = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: "short" })
  );

  const monthName = new Date(year, month - 1, 1)
    .toLocaleDateString(i18n.language, { month: "long" });

  const legendItem = (color: string, text: string) => (
    <span key={text} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {text}
    </span>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
      background: "var(--color-surface)", overflow: "hidden",
    }}>
      <header style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
        gap: "0.75rem", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 1rem",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <h2 style={{
            margin: 0, fontSize: "1rem", fontWeight: 600,
            color: "var(--color-text-primary)", textTransform: "capitalize",
          }}>
            {monthName}
          </h2>
          <span style={{
            fontFamily: PM.mono, fontSize: "0.875rem",
            color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums",
          }}>
            {year}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <button type="button" onClick={onPrev} aria-label={t("pmp.calendar.prev")} style={iconBtn}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={onToday} style={{
            padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 500,
            borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
            background: "var(--color-surface)", color: "var(--color-text-primary)", cursor: "pointer",
          }}>
            {t("pmp.calendar.today")}
          </button>
          <button type="button" onClick={onNext} aria-label={t("pmp.calendar.next")} style={iconBtn}>
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)",
      }}>
        {weekdays.map((d, i) => (
          <div key={i} style={{
            padding: "0.5rem 0", textAlign: "center", fontSize: "0.6875rem",
            fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--color-text-secondary)", opacity: i > 4 ? 0.6 : 1,
          }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 1, background: "var(--color-border)", padding: 1,
      }}>
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} style={{ minHeight: 92, background: "var(--color-bg)" }} />;
          }

          const key        = dateKey(year, month, day);
          const bucket     = buckets.get(key);
          const total      = bucket?.total ?? 0;
          const active     = bucket ? bucket.total - bucket.cancelled : 0;
          const isSelected = selected === key;
          const isToday    = today === key;
          const accent     = tintAccent(bucket);

          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              aria-label={t("pmp.calendar.dayLabel", { day, count: total })}
              style={{
                minHeight: 92, display: "flex", flexDirection: "column",
                alignItems: "flex-start", gap: "0.4rem", padding: "0.5rem",
                textAlign: "left", cursor: "pointer", border: "none", font: "inherit",
                background: dayTint(bucket),
                boxShadow: isSelected ? "inset 0 0 0 2px var(--color-text-primary)" : "none",
              }}
            >
              <span style={
                isToday
                  ? {
                      fontFamily: PM.mono, fontSize: "0.75rem", fontWeight: 700,
                      width: 20, height: 20, display: "flex", alignItems: "center",
                      justifyContent: "center", borderRadius: "50%",
                      background: "var(--color-text-primary)", color: "var(--color-surface)",
                    }
                  : {
                      fontFamily: PM.mono, fontSize: "0.75rem", fontWeight: 400,
                      color: "var(--color-text-secondary)",
                      opacity: total > 0 ? 0.9 : 0.5,
                    }
              }>
                {day}
              </span>

              {total > 0 && (
                <>
                  <span style={{
                    display: "inline-flex", alignItems: "baseline", gap: "0.2rem",
                    borderRadius: 999, padding: "0.15rem 0.45rem",
                    background: "var(--color-surface)",
                    border: `1px solid ${accent}`,
                  }}>
                    <span style={{
                      fontFamily: PM.mono, fontSize: "0.9375rem", fontWeight: 700,
                      lineHeight: 1, color: "var(--color-text-primary)",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {total}
                    </span>
                    <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      {t("pmp.calendar.unit")}
                    </span>
                  </span>

                  {active > 0 && (
                    <span style={{
                      marginTop: "auto", display: "flex", height: 4, width: "100%",
                      overflow: "hidden", borderRadius: 999, background: "var(--color-border)",
                    }}>
                      <span style={{ height: "100%", background: PM.success, width: `${((bucket?.complete ?? 0) / active) * 100}%` }} />
                      <span style={{ height: "100%", background: PM.hold,    width: `${((bucket?.hold ?? 0) / active) * 100}%` }} />
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <footer style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem",
        borderTop: "1px solid var(--color-border)", padding: "0.625rem 1rem",
        fontSize: "0.6875rem", color: "var(--color-text-secondary)",
      }}>
        {legendItem(PM.success, t("pmp.legend.allDone"))}
        {legendItem(PM.hold,    t("pmp.legend.hasHold"))}
        {legendItem(PM.accent,  t("pmp.legend.pending"))}
      </footer>
    </div>
  );
}