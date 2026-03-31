import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Save, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { TargetsService } from "./targets.service";
import {
  BusinessUnit, WeeklyTarget, WeeklyWIP,
  DAY_KEYS, DayKey, DAY_LABELS,
} from "./types";

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

interface BUState {
  target: WeeklyTarget | null;
  wip:    WeeklyWIP | null;
  targetDraft: Record<DayKey, number | null> & { general: number };
  wipDraft: Record<string, number | null> & { general_actual: number; general_goal: number };
  loading: boolean;
  saving:  boolean;
  dirty:   boolean;
  expanded: boolean;
}

function initDraft(target: WeeklyTarget | null, wip: WeeklyWIP | null) {
  const general = target?.general_target ?? 400;
  const targetDraft: any = { general };
  DAY_KEYS.forEach((d) => {
    targetDraft[d] = target?.[d] ?? general;
  });

  const wipDraft: any = {
    general_actual: wip?.general_actual ?? 0,
    general_goal:   wip?.general_goal   ?? 0,
  };
  DAY_KEYS.forEach((d) => {
    wipDraft[`${d}_actual`] = wip?.[`${d}_actual` as keyof WeeklyWIP] ?? wipDraft.general_actual;
    wipDraft[`${d}_goal`]   = wip?.[`${d}_goal`   as keyof WeeklyWIP] ?? wipDraft.general_goal;
  });

  return { targetDraft, wipDraft };
}

export default function TargetsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const [weekDate, setWeekDate] = useState<string>(todayStr());
  const [weekStart, setWeekStart] = useState<string>(getMonday(new Date()));
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [buStates, setBuStates] = useState<Record<string, BUState>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    TargetsService.getBusinessUnits()
      .then(setBusinessUnits)
      .catch(() => setGlobalError("Error cargando Business Units"));
  }, []);

  const loadBU = useCallback(async (bu: BusinessUnit, week: string) => {
    setBuStates((prev) => ({
      ...prev,
      [bu.code]: { ...prev[bu.code], loading: true },
    }));
    try {
      const [target, wip] = await Promise.all([
        TargetsService.getWeeklyTarget(week, bu.code),
        TargetsService.getWeeklyWIP(week, bu.code),
      ]);
      const { targetDraft, wipDraft } = initDraft(target, wip);
      setBuStates((prev) => ({
        ...prev,
        [bu.code]: {
          target,
          wip,
          targetDraft,
          wipDraft,
          loading:  false,
          saving:   false,
          dirty:    false,
          expanded: prev[bu.code]?.expanded ?? true,
        },
      }));
    } catch {
      setBuStates((prev) => ({
        ...prev,
        [bu.code]: { ...prev[bu.code], loading: false },
      }));
    }
  }, []);

  useEffect(() => {
    if (businessUnits.length === 0) return;
    const week = getMonday(new Date(weekDate + "T12:00:00"));
    setWeekStart(week);
    businessUnits.forEach((bu) => loadBU(bu, week));
  }, [weekDate, businessUnits, loadBU]);

  const updateTargetDay = (buCode: string, day: DayKey, value: number) => {
    setBuStates((prev) => ({
      ...prev,
      [buCode]: {
        ...prev[buCode],
        dirty: true,
        targetDraft: { ...prev[buCode].targetDraft, [day]: value },
      },
    }));
  };

  const updateTargetGeneral = (buCode: string, value: number) => {
    setBuStates((prev) => {
      const days: any = {};
      DAY_KEYS.forEach((d) => { days[d] = value; });
      return {
        ...prev,
        [buCode]: {
          ...prev[buCode],
          dirty: true,
          targetDraft: { ...prev[buCode].targetDraft, general: value, ...days },
        },
      };
    });
  };

  const updateWIPField = (buCode: string, field: string, value: number) => {
    setBuStates((prev) => ({
      ...prev,
      [buCode]: {
        ...prev[buCode],
        dirty: true,
        wipDraft: { ...prev[buCode].wipDraft, [field]: value },
      },
    }));
  };

  const applyWIPGeneralToAll = (buCode: string) => {
    setBuStates((prev) => {
      const { general_actual, general_goal } = prev[buCode].wipDraft;
      const days: any = {};
      DAY_KEYS.forEach((d) => {
        days[`${d}_actual`] = general_actual;
        days[`${d}_goal`]   = general_goal;
      });
      return {
        ...prev,
        [buCode]: {
          ...prev[buCode],
          dirty: true,
          wipDraft: { ...prev[buCode].wipDraft, ...days },
        },
      };
    });
  };

  const saveBU = async (bu: BusinessUnit) => {
    const state = buStates[bu.code];
    if (!state) return;
    setBuStates((prev) => ({ ...prev, [bu.code]: { ...prev[bu.code], saving: true } }));
    try {
      const targetPayload: any = {
        week_date:      weekDate,
        bu_code:        bu.code,
        general_target: state.targetDraft.general,
      };
      DAY_KEYS.forEach((d) => { targetPayload[d] = state.targetDraft[d]; });

      const wipPayload: any = {
        week_date:      weekDate,
        bu_code:        bu.code,
        general_actual: state.wipDraft.general_actual,
        general_goal:   state.wipDraft.general_goal,
      };
      DAY_KEYS.forEach((d) => {
        wipPayload[`${d}_actual`] = state.wipDraft[`${d}_actual`];
        wipPayload[`${d}_goal`]   = state.wipDraft[`${d}_goal`];
      });

      await Promise.all([
        TargetsService.saveWeeklyTarget(targetPayload),
        TargetsService.saveWeeklyWIP(wipPayload),
      ]);

      setBuStates((prev) => ({
        ...prev,
        [bu.code]: { ...prev[bu.code], saving: false, dirty: false },
      }));
    } catch {
      setBuStates((prev) => ({ ...prev, [bu.code]: { ...prev[bu.code], saving: false } }));
    }
  };

  const toggleExpanded = (buCode: string) => {
    setBuStates((prev) => ({
      ...prev,
      [buCode]: { ...prev[buCode], expanded: !prev[buCode].expanded },
    }));
  };

  const s = styles;

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.title}>
            {lang === "es" ? "Configuración de Metas" : "Targets Configuration"}
          </h1>
          <p style={s.subtitle}>
            {lang === "es"
              ? "Metas semanales de producción y WIP por Business Unit"
              : "Weekly production targets and WIP goals by Business Unit"}
          </p>
        </div>
        <div style={s.weekSelector}>
          <label style={s.weekLabel}>
            {lang === "es" ? "Semana:" : "Week:"}
          </label>
          <input
            type="date"
            value={weekDate}
            onChange={(e) => setWeekDate(e.target.value)}
            style={s.dateInput}
          />
          <span style={s.weekBadge}>
            {lang === "es" ? "Lunes:" : "Week of:"} {weekStart}
          </span>
        </div>
      </div>

      {globalError && <div style={s.errorBanner}>{globalError}</div>}

      {businessUnits.map((bu) => {
        const state = buStates[bu.code];
        if (!state) return null;
        const { targetDraft, wipDraft, loading, saving, dirty, expanded } = state;

        return (
          <div key={bu.code} style={s.buCard}>
            <div style={s.buHeader} onClick={() => toggleExpanded(bu.code)}>
              <div style={s.buHeaderLeft}>
                <div style={s.buBadge}>{bu.code.toUpperCase()}</div>
                <span style={s.buName}>{bu.name}</span>
                {dirty && <span style={s.dirtyBadge}>
                  {lang === "es" ? "Sin guardar" : "Unsaved"}
                </span>}
              </div>
              <div style={s.buHeaderRight}>
                {dirty && (
                  <button
                    style={s.saveBtn}
                    onClick={(e) => { e.stopPropagation(); saveBU(bu); }}
                    disabled={saving}
                  >
                    {saving
                      ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                      : <Save size={14} />}
                    <span>{saving
                      ? (lang === "es" ? "Guardando..." : "Saving...")
                      : (lang === "es" ? "Guardar" : "Save")}
                    </span>
                  </button>
                )}
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {expanded && (
              <div style={s.buBody}>
                {loading ? (
                  <div style={s.loadingRow}>
                    {lang === "es" ? "Cargando..." : "Loading..."}
                  </div>
                ) : (
                  <>
                    {/* TARGETS SECTION */}
                    <div style={s.sectionTitle}>
                      {lang === "es" ? "Metas de Producción" : "Production Targets"}
                    </div>

                    <div style={s.generalRow}>
                      <label style={s.fieldLabel}>
                        {lang === "es" ? "Meta general diaria" : "General daily target"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={targetDraft.general}
                        onChange={(e) => updateTargetGeneral(bu.code, Number(e.target.value))}
                        style={s.numberInput}
                      />
                      <span style={s.helperText}>
                        {lang === "es"
                          ? "Aplica a todos los días automáticamente"
                          : "Applies to all days automatically"}
                      </span>
                    </div>

                    <div style={s.dayGrid}>
                      {DAY_KEYS.map((day) => (
                        <div key={day} style={s.dayCell}>
                          <label style={s.dayLabel}>
                            {DAY_LABELS[day][lang]}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={targetDraft[day] ?? targetDraft.general}
                            onChange={(e) => updateTargetDay(bu.code, day, Number(e.target.value))}
                            style={s.numberInput}
                          />
                        </div>
                      ))}
                    </div>

                    {/* WIP SECTION */}
                    <div style={{ ...s.sectionTitle, marginTop: "1.5rem" }}>
                      {lang === "es" ? "WIP Line Goals" : "WIP Line Goals"}
                    </div>

                    <div style={s.wipGeneralRow}>
                      <div style={s.wipGeneralField}>
                        <label style={s.fieldLabel}>
                          {lang === "es" ? "WIP Actual general" : "General WIP Actual"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={wipDraft.general_actual}
                          onChange={(e) => updateWIPField(bu.code, "general_actual", Number(e.target.value))}
                          style={s.numberInput}
                        />
                      </div>
                      <div style={s.wipGeneralField}>
                        <label style={s.fieldLabel}>
                          {lang === "es" ? "WIP Goal general" : "General WIP Goal"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={wipDraft.general_goal}
                          onChange={(e) => updateWIPField(bu.code, "general_goal", Number(e.target.value))}
                          style={s.numberInput}
                        />
                      </div>
                      <button
                        style={s.applyBtn}
                        onClick={() => applyWIPGeneralToAll(bu.code)}
                      >
                        {lang === "es" ? "Aplicar a todos los días" : "Apply to all days"}
                      </button>
                    </div>

                    <div style={s.wipGrid}>
                      <div style={s.wipGridHeader}>
                        <span>{lang === "es" ? "Día" : "Day"}</span>
                        <span>Actual</span>
                        <span>Goal</span>
                      </div>
                      {DAY_KEYS.map((day) => (
                        <div key={day} style={s.wipGridRow}>
                          <span style={s.wipDayLabel}>{DAY_LABELS[day][lang]}</span>
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={wipDraft[`${day}_actual`] ?? wipDraft.general_actual}
                            onChange={(e) => updateWIPField(bu.code, `${day}_actual`, Number(e.target.value))}
                            style={s.numberInputSm}
                          />
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={wipDraft[`${day}_goal`] ?? wipDraft.general_goal}
                            onChange={(e) => updateWIPField(bu.code, `${day}_goal`, Number(e.target.value))}
                            style={s.numberInputSm}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:        { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pageHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" },
  title:       { fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 },
  subtitle:    { fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  weekSelector:{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  weekLabel:   { fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" },
  dateInput:   {
    padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", fontSize: "0.875rem",
  },
  weekBadge:   {
    fontSize: "0.8rem", padding: "0.25rem 0.75rem",
    borderRadius: "var(--radius-full, 9999px)",
    background: "rgba(59,130,246,0.1)", color: "var(--color-primary)",
    fontWeight: 600,
  },
  errorBanner: {
    padding: "0.75rem 1rem", borderRadius: "var(--radius-md)",
    background: "rgba(220,38,38,0.08)", color: "var(--color-stopped)",
    border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.875rem",
  },
  buCard:      {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", overflow: "hidden",
  },
  buHeader:    {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "1rem 1.25rem", cursor: "pointer",
    borderBottom: "1px solid var(--color-border)",
    background: "var(--color-surface-raised, var(--color-surface))",
  },
  buHeaderLeft:  { display: "flex", alignItems: "center", gap: "0.75rem" },
  buHeaderRight: { display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--color-text-secondary)" },
  buBadge:     {
    fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em",
    padding: "0.25rem 0.625rem", borderRadius: "var(--radius-sm)",
    background: "rgba(59,130,246,0.1)", color: "var(--color-primary)",
    fontFamily: "monospace",
  },
  buName:      { fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" },
  dirtyBadge:  {
    fontSize: "0.7rem", fontWeight: 600, padding: "0.125rem 0.5rem",
    borderRadius: "var(--radius-full, 9999px)",
    background: "rgba(245,158,11,0.12)", color: "#d97706",
  },
  saveBtn:     {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.4rem 0.875rem", borderRadius: "var(--radius-md)",
    background: "var(--color-primary)", color: "#fff",
    border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600,
  },
  buBody:      { padding: "1.25rem" },
  loadingRow:  { color: "var(--color-text-secondary)", padding: "1rem", textAlign: "center" },
  sectionTitle:{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--color-border)" },
  generalRow:  { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" },
  fieldLabel:  { fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" },
  numberInput: {
    width: "100px", padding: "0.4rem 0.625rem",
    borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
    background: "var(--color-surface)", color: "var(--color-text-primary)",
    fontSize: "0.875rem", textAlign: "center",
  },
  numberInputSm: {
    width: "80px", padding: "0.35rem 0.5rem",
    borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
    background: "var(--color-surface)", color: "var(--color-text-primary)",
    fontSize: "0.8125rem", textAlign: "center",
  },
  helperText:  { fontSize: "0.75rem", color: "var(--color-text-tertiary)" },
  dayGrid:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" },
  dayCell:     { display: "flex", flexDirection: "column", gap: "0.375rem" },
  dayLabel:    { fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-primary)" },
  wipGeneralRow: { display: "flex", alignItems: "flex-end", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" },
  wipGeneralField: { display: "flex", flexDirection: "column", gap: "0.375rem" },
  applyBtn:    {
    padding: "0.4rem 0.875rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", cursor: "pointer", fontSize: "0.8125rem",
    fontWeight: 600, alignSelf: "flex-end",
  },
  wipGrid:     { display: "flex", flexDirection: "column", gap: "0.5rem" },
  wipGridHeader: {
    display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: "0.5rem",
    fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)",
    textTransform: "uppercase", letterSpacing: "0.04em",
    padding: "0 0.25rem",
  },
  wipGridRow:  { display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: "0.5rem", alignItems: "center" },
  wipDayLabel: { fontSize: "0.8125rem", color: "var(--color-text-primary)", fontWeight: 500 },
};