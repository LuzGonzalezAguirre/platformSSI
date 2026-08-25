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

/**
 * BUs seleccionables para Scrap Rate. NO incluye "GLOBAL" ni "JOHN_DEERE":
 * GLOBAL dejo de ser un valor pedible (ahora es "sin seleccion = suma de
 * los 3"), y John Deere no esta clasificado por resolve_bu_for_finished_goods
 * en el backend -- pedirlo devolveria ceros silenciosos.
 */
export type ScrapRateBusinessUnit = "VOLVO" | "CUMMINS" | "TULC";

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
  /** BUs efectivamente usadas por el backend. Vacio nunca ocurre en la
   *  respuesta: sin seleccion, el backend ya resolvio a los 3 trackeados. */
  business_units: ScrapRateBusinessUnit[];
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

  /**
   * businessUnits vacio -> no se manda `bu` en absoluto, el backend asume
   * los 3 trackeados. api.client.ts serializa el array como ?bu=X&bu=Y.
   */
  getScrapRateWeekly: (
    startDate: string,
    endDate: string,
    businessUnits: ScrapRateBusinessUnit[]
  ): Promise<ScrapRateResponse> =>
    apiClient
      .get(`${BASE}/scrap-rate/`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          ...(businessUnits.length > 0 ? { bu: businessUnits } : {}),
        },
      })
      .then((r: any) => r.data),
};