export interface ClientMetrics {
  quantity: number;
  target: number;
  production_pct: number;
  cogp_cost: number;
  scrap_qty: number;
  scrap_cost: number;
  scrap_cogp_pct: number;
  yield_pct: number;
  wip_actual: number;
  wip_goal: number;
}

export interface TotalMetrics {
  yield_pct: number;
  production: number;
  scrap: number;
}

export interface DailySummary {
  date: string;
  earned_labor_hours: number;
  volvo: ClientMetrics;
  cummins: ClientMetrics;
  total: TotalMetrics;
}

export type ViewMode = "daily" | "weekly" | "monthly";

export interface TablePeriod {
  label: string;
  label_es: string;
  date_str: string;
  produced: number;
  target: number;
  wip_actual: number;
  wip_goal: number;
  day_pct: number | null;
  cum_produced: number | null;
  cum_target: number | null;
  cum_pct: number | null;
  scrap_cogp_daily: number | null;
  scrap_cogp_cum: number | null;
  scrap_qty: number | null;
  has_data: boolean;
  is_future: boolean;
}

export interface WeeklyTableTotals {
  produced: number;
  target: number;
  pct: number;
  scrap_cogp_cum: number;
}

export interface WeeklyTable {
  mode: ViewMode;
  bu: string;
  periods: TablePeriod[];
  totals: WeeklyTableTotals;
}