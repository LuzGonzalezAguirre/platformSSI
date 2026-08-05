import { useState, useEffect, useCallback, useRef } from "react";
import { PmpService } from "./pmp.service";
import { PmpCalendarResponse } from "./types";

export function usePmpData(year: number, month: number) {
  const [data,    setData]    = useState<PmpCalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await PmpService.getCalendar(year, month);
      if (id !== requestId.current) return;
      setData(result);
    } catch (e: any) {
      if (id !== requestId.current) return;
      setError(e?.response?.data?.detail ?? "load_error");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}