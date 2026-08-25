import { useState, useEffect, useCallback } from "react";
import { WorkRequestsService } from "./work-requests.service";
import { WRDashboard } from "./types";
import { StandardFilters } from "../../../components/common/StandardFilters.types";

export function useWorkRequestsData(filters: StandardFilters) {
  const [data,    setData]    = useState<WRDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!filters.start || !filters.end) return;
    setLoading(true);
    setError(null);
    try {
      const result = await WorkRequestsService.getDashboard(filters.start, filters.end, {
        bu: filters.bu,
        workcenter: filters.workcenter,
      });
      setData(result);
    } catch {
      setError("Error cargando Work Requests");
    } finally {
      setLoading(false);
    }
  }, [filters.start, filters.end, filters.bu, filters.workcenter]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}