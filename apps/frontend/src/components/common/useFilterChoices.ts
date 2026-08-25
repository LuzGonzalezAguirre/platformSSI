import { useState, useEffect } from "react";
import apiClient from "../../services/api.client";

interface Choice { value: string; label: string; }
interface FilterChoices { bu: Choice[]; shift: Choice[]; workcenter: Choice[]; }

const EMPTY: FilterChoices = { bu: [], shift: [], workcenter: [] };

export function useFilterChoices() {
  const [choices, setChoices] = useState<FilterChoices>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/common/filter-choices/")
      .then((r: any) => { if (!cancelled) setChoices(r.data); })
      .catch(() => { if (!cancelled) setChoices(EMPTY); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { choices, loading };
}