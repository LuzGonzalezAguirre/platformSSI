import { useState, useEffect, useCallback } from "react";
import { DashboardTargetsService } from "./dashboard-targets.service";
import { DashboardTarget } from "./types";

export function useDashboardTargets() {
  const [targets, setTargets] = useState<DashboardTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DashboardTargetsService.getTargets();
      setTargets(data.map((t) => ({ ...t, target_value: Number(t.target_value) })));
    } catch {
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getTarget = useCallback(
    (metricKey: string): DashboardTarget | undefined => targets.find((t) => t.metric_key === metricKey),
    [targets]
  );

  return { targets, getTarget, loading, refetch: load };
}
