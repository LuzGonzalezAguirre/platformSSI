import { useTranslation } from "react-i18next";
import { RefreshCw, Play } from "lucide-react";
import DateRangeSelector from "./DateRangeSelector";
import BUSelect from "./BUSelect";
import WorkcenterSelect from "./WorkcenterSelect";
import ShiftSelect from "./ShiftSelect";
import { StandardFilters } from "./StandardFilters.types";
import { useFilterChoices } from "./useFilterChoices";

interface Props {
  draft: StandardFilters;
  setDraft: (f: StandardFilters) => void;
  onApply: () => void;
  loading?: boolean;
  extra?: React.ReactNode; // slot para filtros propios del módulo (ej. status en quality)
}

export default function FilterBar({ draft, setDraft, onApply, loading, extra }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { choices } = useFilterChoices();

  return (
    <div style={s.bar}>
      <DateRangeSelector
        value={{ start: draft.start, end: draft.end }}
        onChange={(range) => setDraft({ ...draft, ...range })}
        defaultPreset="today"
      />
      <BUSelect value={draft.bu} onChange={(bu) => setDraft({ ...draft, bu })} options={choices.bu} />
      <WorkcenterSelect
        value={draft.workcenter}
        onChange={(workcenter) => setDraft({ ...draft, workcenter })}
        options={choices.workcenter}
      />
      <ShiftSelect value={draft.shift} onChange={(shift) => setDraft({ ...draft, shift })} />
      {extra}
      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        style={{ ...s.loadBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "default" : "pointer" }}
      >
        {loading ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={16} />}
        <span>{lang === "es" ? "Cargar" : "Load"}</span>
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  loadBtn: {
    display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4375rem 1rem",
    background: "var(--color-primary, #3b82f6)", color: "#fff", border: "none",
    borderRadius: "var(--radius-md)", fontSize: "0.8125rem", fontWeight: 600,
  },
};