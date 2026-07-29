import apiClient from "../../../services/api.client";

const BASE = "/quality/cogp";

export interface CogpWeekPoint {
  iso_year: number;
  iso_week: number;
  scrap_cost: string;
  extended_cost: string;
  cogp_pct: string | null;
}

export interface CogpWeeklyTrendResponse {
  volvo: CogpWeekPoint[];
  cummins: CogpWeekPoint[];
  tulc: CogpWeekPoint[];
  global: CogpWeekPoint[];
}


export interface CogpMappingRow {
  part_no: string;
  part_name: string;
  customer_no: number | null;
  customer_name: string;
  business_unit: string;
  classification_source: string;
}

export interface CogpMappingResponse {
  count: number;
  results: CogpMappingRow[];
}

export const CogpService = {
  getWeeklyTrend: (startDate: string, endDate: string): Promise<CogpWeeklyTrendResponse> =>
    apiClient
      .get(`${BASE}/weekly-trend/`, { params: { start_date: startDate, end_date: endDate } })
      .then((r: any) => r.data),

  getMappingCatalog: (params: { business_unit?: string; search?: string }): Promise<CogpMappingResponse> =>
    apiClient
      .get(`${BASE}/mapping/`, { params })
      .then((r: any) => r.data),
  getPareto: (period: CogpPeriod, date: string): Promise<CogpParetoResponse> =>
    apiClient
      .get(`${BASE}/pareto/`, { params: { period, date } })
      .then((r: any) => r.data),
};
export interface CogpParetoItem {
  reason: string;
  workcenter: string;
  cost: string;
  pct_of_total: string;
}

export interface CogpParetoBucket {
  total_scrap: string;
  total_extended_cost: string;
  scrap_rate_pct: string | null;
  items: CogpParetoItem[];
}

export interface CogpParetoResponse {
  period: "day" | "week" | "month";
  start_date: string;
  end_date: string;
  volvo: CogpParetoBucket;
  cummins: CogpParetoBucket;
  tulc: CogpParetoBucket;
  global: CogpParetoBucket;
}

export type CogpPeriod = "day" | "week" | "month";