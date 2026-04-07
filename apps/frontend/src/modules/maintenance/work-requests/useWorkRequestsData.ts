import { useState, useEffect, useCallback } from "react";
import { WorkRequestsService } from "./work-requests.service";
import { WRDashboard, DateRange } from "./types";

export function useWorkRequestsData(range: DateRange) {
  const [data,    setData]    = useState<WRDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!range.start || !range.end) return;
    setLoading(true);
    setError(null);
    try {
      const result = await WorkRequestsService.getDashboard(range.start, range.end);
      setData(result);
    } catch {
      setError("Error cargando Work Requests");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}