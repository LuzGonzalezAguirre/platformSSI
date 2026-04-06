import apiClient from "../../../services/api.client";
import { DailySummary } from "./types";
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
};

