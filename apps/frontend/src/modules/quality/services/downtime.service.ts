import apiClient from "../../../services/api.client";

export type DowntimePreset = "today" | "yesterday" | "this_week" | "this_month" | "custom";

export interface DowntimeLogRow {
  log_date:               string | null;
  log_hours:              number | null;
  status:                 string | null;
  reason:                 string | null;
  notes:                  string | null;
  workcenter:             string | null;
  shift:                  string | null;
  part_no:                string | null;
  operation_no:           number | string | null;
  operation_description:  string | null;
  job_no:                 string | null;
}

export interface DowntimeLogsResponse {
  date_from:   string;
  date_to:     string;
  count:       number;
  total_hours: number;
  results:     DowntimeLogRow[];
}

export type DowntimeTrendGranularity = "daily" | "week" | "month";

export interface DowntimeTrendPoint {
  date:            string;
  total_hours:     number;
  incident_count:  number;
}

export interface DowntimeTrendResponse {
  granularity: DowntimeTrendGranularity;
  date_from:   string;
  date_to:     string;
  points:      DowntimeTrendPoint[];
}

const BASE = "/quality/downtime";

export const DowntimeService = {
  getLogs: async (
    preset: DowntimePreset,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<DowntimeLogsResponse> => {
    const params: Record<string, string> = { preset };
    if (preset === "custom") {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
    }
    const { data } = await apiClient.get(`${BASE}/logs/`, { params });
    return data;
  },

  getTrend: async (
    granularity: DowntimeTrendGranularity,
    endDate?: string,
  ): Promise<DowntimeTrendResponse> => {
    const params: Record<string, string> = { granularity };
    if (endDate) params.end_date = endDate;
    const { data } = await apiClient.get(`${BASE}/trend/`, { params });
    return data;
  },
};