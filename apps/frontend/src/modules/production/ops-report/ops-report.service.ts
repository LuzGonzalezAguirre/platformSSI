import apiClient from "../../../services/api.client";
import { DailySummary,OEERecord, OEEWritePayload } from "./types";
import { WeeklyTable, ViewMode } from "./types";


const BASE = "/production";

export const OpsReportService = {
  getDailySummary: (date: string): Promise<DailySummary> =>
    apiClient
      .get(`${BASE}/ops/daily-summary/`, { params: { date } })
      .then((r: any) => r.data),

  getWeeklyTable: (date: string, bu: string, mode: ViewMode): Promise<WeeklyTable> =>
    apiClient
        .get(`/production/ops/weekly-table/`, { params: { date, bu, mode } })
        .then((r: any) => r.data),

  getOEE: (date: string): Promise<OEERecord | null> =>
    apiClient.get(`/production/ops/oee/`, { params: { date } })
        .then((r: any) => Object.keys(r.data).length === 0 ? null : r.data)
        .catch(() => null),

  saveOEE: (payload: OEEWritePayload): Promise<OEERecord> =>
    apiClient.post(`/production/ops/oee/`, payload).then((r: any) => r.data),
};

