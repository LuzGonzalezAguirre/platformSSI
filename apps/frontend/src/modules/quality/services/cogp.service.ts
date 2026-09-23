import { ActionTrackerAction } from "../../../components/common/actionTracker.types";
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
  john_deere: CogpWeekPoint[];
  eaton: CogpWeekPoint[];
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
  actions: ActionTrackerAction[];
}

export interface CogpPieceItem {
  reason: string;
  workcenter: string;
  quantity: number;
  pct_of_total: string;
  actions: ActionTrackerAction[];
}

export interface CogpCurrentOffendersResult {
  start_date: string;
  end_date: string;
  red_business_units: string[];
  offenders_detected: number;
  staged: number;
  source_keys: string[];
}

export interface CogpSettings {
  cost_target_pct: string;
  pieces_target_pct: string;
  can_edit: boolean;
}

export interface CogpScrapTest {
  test_run_id: string;
  business_unit: string;
  workcenter: string;
  part_no: string;
  part_name: string;
  reason: string;
  scrap_cost: string;
  scrap_qty: string;
  production_cost: string;
  produced_qty: string;
}

export interface CogpParetoBucket {
  total_scrap: string;
  total_extended_cost: string;
  scrap_rate_pct: string | null;
  items: CogpParetoItem[];
  total_scrap_qty: number;
  total_produced_qty: number;
  piece_rate_pct: string | null;
  piece_items: CogpPieceItem[];
}

export interface CogpParetoResponse {
  start_date: string;
  end_date: string;
  actions: ActionTrackerAction[];
  volvo: CogpParetoBucket;
  cummins: CogpParetoBucket;
  tulc: CogpParetoBucket;
  john_deere: CogpParetoBucket;
  eaton: CogpParetoBucket;
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
  stageCurrentOffenders: (data: { start_date: string; end_date: string; workcenter?: string[] }): Promise<CogpCurrentOffendersResult> =>
    apiClient.post(`${BASE}/scrap-integration/current-offenders/`, data).then((r: any) => r.data),
  createScrapTest: (data: CogpScrapTest): Promise<{ source_key: string; tracker_code: string }> =>
    apiClient.post(`${BASE}/scrap-integration/test/`, data).then((r: any) => r.data),
  getSettings: (): Promise<CogpSettings> =>
    apiClient.get(`${BASE}/settings/`).then((r: any) => r.data),

  updateSettings: (targets: Pick<CogpSettings, "cost_target_pct" | "pieces_target_pct">): Promise<CogpSettings> =>
    apiClient.put(`${BASE}/settings/`, targets).then((r: any) => r.data),
  getWeeklyTrend: (
    startDate: string, endDate: string, workcenter: string[] = []
  ): Promise<CogpWeeklyTrendResponse> =>
    apiClient
      .get(`${BASE}/weekly-trend/`, {
        params: {
          start_date: startDate, end_date: endDate,
          ...(workcenter.length > 0 ? { workcenter } : {}),
        },
      })
      .then((r: any) => r.data),

  getMappingCatalog: (params: { business_unit?: string; search?: string }): Promise<CogpMappingResponse> =>
    apiClient
      .get(`${BASE}/mapping/`, { params })
      .then((r: any) => r.data),

     getPareto: (
    startDate: string, endDate: string, workcenter: string[] = []
  ): Promise<CogpParetoResponse> =>
    apiClient
      .get(`${BASE}/pareto/`, {
        params: {
          start_date: startDate, end_date: endDate,
          ...(workcenter.length > 0 ? { workcenter } : {}),
        },
      })
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
