import { useState, useEffect, useCallback } from "react";
import { MaintenanceService } from "./overview.service";
import { MaintenanceKPIs, DowntimeReason, DateRange, OEEData, OEETrendPoint, DowntimeByMonth } from "./types";

function lastDayOfRange(end: string): string {
  const d = new Date(end + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export function useMaintenanceData(range: DateRange) {
  const [kpis,          setKpis]          = useState<MaintenanceKPIs | null>(null);
  const [reasons,       setReasons]       = useState<DowntimeReason[]>([]);
  const [grandTotal,    setGrandTotal]    = useState<number>(0);
  const [oee,           setOee]           = useState<OEEData | null>(null);
  const [oeeTrend,      setOeeTrend]      = useState<OEETrendPoint[]>([]);
  const [downtimeMonth, setDowntimeMonth] = useState<DowntimeByMonth[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!range.start || !range.end) return;
    setLoading(true);
    setError(null);
    try {
      const [kpiRes, reasonRes, oeeRes, trendRes, monthRes] = await Promise.all([
        MaintenanceService.getKPIs(range.start, range.end),
        MaintenanceService.getReasons(range.start, range.end),
        MaintenanceService.getOEELive(range.start, range.end),
        MaintenanceService.getOEETrend(range.start, range.end),
        MaintenanceService.getDowntimeByMonth(range.start, range.end),
      ]);
      setKpis(kpiRes.data);
      setReasons(reasonRes.data);
      setGrandTotal(reasonRes.grand_total_hours);
      setOee(oeeRes);
      setOeeTrend(trendRes.data);
      setDowntimeMonth(monthRes.data);
    } catch {
      setError("Error cargando datos de mantenimiento");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => { load(); }, [load]);

  return { kpis, reasons, grandTotal, oee, oeeTrend, downtimeMonth, loading, error, reload: load };
}