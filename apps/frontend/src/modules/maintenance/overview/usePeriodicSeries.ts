import { useState, useEffect } from "react";
import { DateRange } from "./types";

export type ChartPeriod = "day" | "week" | "month";

export function computePeriodRange(period: ChartPeriod, dayRange: DateRange): DateRange {
  if (period === "day") return dayRange;
  const end   = new Date();
  const start = new Date(end);
  if (period === "week")  start.setDate(start.getDate() - 7 * 6);
  if (period === "month") start.setMonth(start.getMonth() - 5, 1); // incluye el mes actual + 5 anteriores
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}

// Modo "day" usa `dayData` (ya cargada por OverviewPage vía el rango global +
// botón "Cargar") sin fetch propio. Modo "week"/"month" ignora el rango global
// por completo y dispara su propio fetch autónomo, con su propio loading/error —
// no depende de useMaintenanceData ni del botón "Cargar".
export function usePeriodicSeries<T>(
  period: ChartPeriod,
  dayRange: DateRange,
  dayData: T,
  fetchFn: (start: string, end: string) => Promise<T>,
) {
  const [fetchedData, setFetchedData] = useState<T>(dayData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (period === "day") return;

    let cancelled = false;
    const { start, end } = computePeriodRange(period, dayRange);
    setLoading(true);
    setError(null);
    fetchFn(start, end)
      .then((result) => { if (!cancelled) setFetchedData(result); })
      .catch(() => { if (!cancelled) setError("Error cargando datos"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // Depende únicamente de `period` — cambiar el rango global no debe
    // re-disparar el fetch de un chart que ya está en modo week/month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  if (period === "day") {
    return { data: dayData, loading: false, error: null };
  }
  return { data: fetchedData, loading, error };
}
