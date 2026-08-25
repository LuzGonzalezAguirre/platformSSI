import { useState, useEffect, useCallback } from "react";
import { MaintenanceService } from "./overview.service";
import { MaintenanceKPIs, DowntimeReason, OEEData, OEETrendPoint, DowntimeByMonth } from "./types";
import { StandardFilters } from "../../../components/common/StandardFilters.types";

export function useMaintenanceData(filters: StandardFilters) {
  const [kpis,          setKpis]          = useState<MaintenanceKPIs | null>(null);
  const [reasons,       setReasons]       = useState<DowntimeReason[]>([]);
  const [grandTotal,    setGrandTotal]    = useState<number>(0);
  const [oee,           setOee]           = useState<OEEData | null>(null);
  const [oeeTrend,      setOeeTrend]      = useState<OEETrendPoint[]>([]);
  const [downtimeMonth, setDowntimeMonth] = useState<DowntimeByMonth[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!filters.start || !filters.end) return;
    setLoading(true);
    setError(null);
    try {
      const [kpiRes, reasonRes, oeeRes, trendRes, monthRes] = await Promise.all([
        MaintenanceService.getKPIs(filters.start, filters.end, {
          bu: filters.bu,
          workcenter: filters.workcenter,
          shift: filters.shift,
        }),
        MaintenanceService.getReasons(filters.start, filters.end),
        MaintenanceService.getOEELive(filters.start, filters.end),
        MaintenanceService.getOEETrend(filters.start, filters.end),
        MaintenanceService.getDowntimeByMonth(filters.start, filters.end),
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
  }, [filters.start, filters.end, filters.bu, filters.workcenter, filters.shift]);

  useEffect(() => { load(); }, [load]);

  return { kpis, reasons, grandTotal, oee, oeeTrend, downtimeMonth, loading, error, reload: load };
}