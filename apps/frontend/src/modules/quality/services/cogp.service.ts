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
};