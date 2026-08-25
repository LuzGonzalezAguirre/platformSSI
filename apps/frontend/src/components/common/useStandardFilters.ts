import { useState } from "react";
import { DatePreset, resolvePreset } from "./date-presets";
import { StandardFilters, EMPTY_STANDARD_FILTERS_EXTRA } from "./StandardFilters.types";

function initial(defaultPreset: Exclude<DatePreset, "custom">): StandardFilters {
  return { ...resolvePreset(defaultPreset), ...EMPTY_STANDARD_FILTERS_EXTRA };
}

export function useStandardFilters(defaultPreset: Exclude<DatePreset, "custom"> = "today") {
  const [draft, setDraft] = useState<StandardFilters>(() => initial(defaultPreset));
  const [applied, setApplied] = useState<StandardFilters>(() => initial(defaultPreset));

  return {
    draft,
    setDraft,
    applied,
    apply: () => setApplied(draft),
    isDirty: JSON.stringify(draft) !== JSON.stringify(applied),
  };
}