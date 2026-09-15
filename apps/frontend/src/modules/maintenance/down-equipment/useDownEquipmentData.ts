import { useCallback, useEffect, useRef, useState } from "react";
import { DownEquipmentService } from "./down-equipment.service";
import { DownEquipmentDashboard } from "./types";

export function useDownEquipmentData(days: number) {
  const [data, setData] = useState<DownEquipmentDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const requestId = useRef(0);

  const load = useCallback(async (silent = false) => {
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await DownEquipmentService.getDashboard(days);
      if (id !== requestId.current) return;
      setData(result);
      setFetchedAt(Date.now());
    } catch (e: any) {
      if (id !== requestId.current) return;
      setError(e?.response?.data?.detail ?? "load_error");
    } finally {
      if (id === requestId.current && !silent) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return { data, loading, error, fetchedAt, reload: () => load() };
}
