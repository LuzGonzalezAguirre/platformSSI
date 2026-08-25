import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DatePreset, DateRange, resolvePreset } from "./date-presets";

export interface OptionDef { preset: DatePreset; es: string; en: string; }
export interface PresetGroup { title_es: string; title_en: string; options: OptionDef[]; }

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  defaultPreset?: DatePreset;
  /**
   * Grupos de presets adicionales, concatenados despues de los grupos
   * incorporados (Dias/Semanas/Meses). Pensado para pantallas de
   * tendencia larga (ej. Scrap Rate: YTD, ultimas 26/52 semanas) que no
   * encajan en el vocabulario general de dias/semanas/meses cortos.
   * Sin esta prop el componente se comporta exactamente igual que antes.
   */
  extraGroups?: PresetGroup[];
}

const GROUPS: PresetGroup[] = [
  {
    title_es: "Días", title_en: "Days",
    options: [
      { preset: "today",     es: "Hoy",   en: "Today" },
      { preset: "yesterday", es: "Ayer",  en: "Yesterday" },
    ],
  },
  {
    title_es: "Semanas", title_en: "Weeks",
    options: [
      { preset: "current_week",  es: "Semana Actual",   en: "Current Week" },
      { preset: "next_week",     es: "Próxima Semana",  en: "Next Week" },
      { preset: "previous_week", es: "Semana Anterior",  en: "Previous Week" },
      { preset: "last_7_days",   es: "Últimos 7 Días",   en: "Last 7 Days" },
    ],
  },
  {
    title_es: "Meses", title_en: "Months",
    options: [
      { preset: "month_to_date",  es: "Mes Actual a la Fecha", en: "Month To Date" },
      { preset: "current_month",  es: "Mes Actual",            en: "Current Month" },
      { preset: "previous_month", es: "Mes Anterior",          en: "Previous Month" },
      { preset: "next_30_days",   es: "Próximos 30 Días",      en: "Next 30 Days" },
      { preset: "last_30_days",   es: "Últimos 30 Días",       en: "Last 30 Days" },
      { preset: "last_60_days",   es: "Últimos 60 Días",       en: "Last 60 Days" },
      { preset: "last_90_days",   es: "Últimos 90 Días",       en: "Last 90 Days" },
    ],
  },
];

function formatShort(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DateRangeSelector({ value, onChange, defaultPreset = "custom", extraGroups }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [preset, setPreset] = useState<DatePreset>(defaultPreset);
  const [open, setOpen]     = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const allGroups = extraGroups && extraGroups.length > 0 ? [...GROUPS, ...extraGroups] : GROUPS;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectPreset(p: DatePreset) {
    setPreset(p);
    setOpen(false);
    if (p !== "custom") onChange(resolvePreset(p));
  }

  const currentLabel = (() => {
    if (preset === "custom") return lang === "es" ? "(rango personalizado)" : "(select custom range)";
    for (const g of allGroups) {
      const opt = g.options.find((o) => o.preset === preset);
      if (opt) return lang === "es" ? opt.es : opt.en;
    }
    return "";
  })();

  return (
    <div ref={rootRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.625rem" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={s.trigger}>
        <span>{currentLabel}</span>
        <span style={{ fontSize: "0.65rem", opacity: 0.6 }}>▾</span>
      </button>

      {preset === "custom" ? (
        <>
          <label style={s.fieldLabel}>{lang === "es" ? "Desde:" : "From:"}</label>
          <input type="date" value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            style={s.dateInput} />
          <label style={s.fieldLabel}>{lang === "es" ? "Hasta:" : "To:"}</label>
          <input type="date" value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            style={s.dateInput} />
        </>
      ) : (
        <span style={s.readonlyRange}>
          {formatShort(value.start)} → {formatShort(value.end)}
        </span>
      )}

      {open && (
        <div style={s.dropdown}>
          <div
            onClick={() => selectPreset("custom")}
            style={{ ...s.option, fontStyle: "italic", borderBottom: "1px solid var(--color-border)" }}
          >
            {lang === "es" ? "(rango personalizado)" : "(select custom range)"}
          </div>
          {allGroups.map((g) => (
            <div key={g.title_en}>
              <div style={s.groupTitle}>{lang === "es" ? g.title_es : g.title_en}</div>
              {g.options.map((o) => (
                <div
                  key={o.preset}
                  onClick={() => selectPreset(o.preset)}
                  style={{ ...s.option, fontWeight: preset === o.preset ? 700 : 400 }}
                >
                  {lang === "es" ? o.es : o.en}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  },
  fieldLabel: { fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontWeight: 500 },
  dateInput: {
    padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", fontSize: "0.875rem",
  },
  readonlyRange: { fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontWeight: 600 },
  dropdown: {
    position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
    minWidth: 220, maxHeight: 360, overflowY: "auto",
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: "0.375rem 0",
  },
  groupTitle: {
    fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
    color: "var(--color-text-secondary)", padding: "0.5rem 0.75rem 0.25rem",
  },
  option: {
    padding: "0.375rem 0.75rem", fontSize: "0.8125rem", color: "var(--color-text-primary)",
    cursor: "pointer",
  },
};