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

// ── Scrap Rate (piezas) ───────────────────────────────────────────────

export type ScrapRateBusinessUnit = "GLOBAL" | "VOLVO" | "CUMMINS" | "TULC";

export interface ScrapRateWeek {
  iso_year: number;
  iso_week: number;
  label: string;
  week_start: string;
  week_end: string;
  produced_qty: number;
  scrap_qty: number;
  scrap_qty_finished: number;
  input_qty: number;
  /** null cuando input_qty es 0 -- tasa indefinida, NO cero. */
  scrap_rate_pct: string | null;
  scrap_rate_finished_pct: string | null;
  has_input: boolean;
  is_partial: boolean;
  is_future: boolean;
}

export interface ScrapRateTotals {
  produced_qty: number;
  scrap_qty: number;
  input_qty: number;
  scrap_rate_pct: string | null;
}

export interface ScrapRateMeta {
  source: string;
  weeks_total: number;
  weeks_from_cache: number;
  weeks_from_plex: number;
}

export interface ScrapRateResponse {
  business_unit: ScrapRateBusinessUnit;
  /** Rango expandido a semanas ISO completas por el backend. */
  start_date: string;
  end_date: string;
  requested_start_date: string;
  requested_end_date: string;
  weeks: ScrapRateWeek[];
  totals: ScrapRateTotals;
  meta: ScrapRateMeta;
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

  getScrapRateWeekly: (
    startDate: string,
    endDate: string,
    businessUnit: ScrapRateBusinessUnit
  ): Promise<ScrapRateResponse> =>
    apiClient
      .get(`${BASE}/scrap-rate/`, {
        params: { start_date: startDate, end_date: endDate, business_unit: businessUnit },
      })
      .then((r: any) => r.data),
};