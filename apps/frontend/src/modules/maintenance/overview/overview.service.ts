import apiClient from "../../../services/api.client";
import { MaintenanceKPIs, DowntimeReason, DowntimeDetail, OEEData, OEETrendPoint, DowntimeByMonth } from "./types";

const BASE      = "/maintenance/overview";
const OEE_BASE  = "/production/ops";

export const MaintenanceService = {
  getKPIs: (start: string, end: string): Promise<{ data: MaintenanceKPIs | null }> =>
    apiClient
      .get(`${BASE}/kpis/`, { params: { start_date: start, end_date: end } })
      .then((r: any) => r.data),

  getReasons: (
    start: string,
    end: string
  ): Promise<{ data: DowntimeReason[]; grand_total_hours: number }> =>
    apiClient
      .get(`${BASE}/reasons/`, { params: { start_date: start, end_date: end } })
      .then((r: any) => r.data),

  getDetail: (
    start: string,
    end: string,
    reason: string
  ): Promise<{ data: DowntimeDetail[] }> =>
    apiClient
      .get(`${BASE}/detail/`, { params: { start_date: start, end_date: end, reason } })
      .then((r: any) => r.data),

  // Reutiliza el mismo endpoint de OPS — mismo OEERecord en PostgreSQL
  getOEELive: (start: string, end: string): Promise<OEEData | null> =>
    apiClient
      .get(`${BASE}/oee-live/`, { params: { start_date: start, end_date: end } })
      .then((r: any) => (Object.keys(r.data).length === 0 ? null : r.data))
      .catch(() => null),

   getOEETrend: (start: string, end: string): Promise<{ data: OEETrendPoint[] }> =>
    apiClient.get(`${BASE}/oee-trend/`, { params: { start_date: start, end_date: end } }).then((r: any) => r.data),

  getDowntimeByMonth: (start: string, end: string): Promise<{ data: DowntimeByMonth[] }> =>
    apiClient.get(`${BASE}/downtime-by-month/`, { params: { start_date: start, end_date: end } }).then((r: any) => r.data),
};