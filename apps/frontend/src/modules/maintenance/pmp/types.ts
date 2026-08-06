export interface PmpFailure {
  failure:        string;
  failure_type:   string;
  failure_action: string;
}

export interface PmpEvent {
  work_request_no:       string;
  description:           string;
  request_date:          string;
  due_date:              string;
  completed_date:        string | null;
  status:                string;
  status_norm?:          PmStatus;
  type:                  string;
  assigned_to:           string;
  equipment_id:          string;
  equipment_description: string;
  equipment_group:       string;
  workcenter:            string;
  workcenter_group:      string;
  department:            string;
  scheduled_hours:       number;
  maintenance_hours:     number;
  failures:              PmpFailure[];
  failure:               string;
  failure_type:          string;
  failure_action:        string;
  bu:                    string;
}

export interface PmpDayCell {
  date:  string;
  count: number;
  by_bu: Record<string, number>;
}

export interface PmpMonthCount {
  month:     number;
  count:     number;
  active?:   number;
  complete?: number;
  pct?:      number | null;
}

export interface PmpBuCount { bu: string; count: number; }

/**
 * plan_pct -> avance sobre el plan anual completo (incluye PM que aun no vencen).
 * ytd_pct  -> cumplimiento sobre lo que ya vencio (schedule compliance).
 * null significa "sin base de calculo", nunca 0.
 */
export interface PmpYearStats {
  total:        number;
  cancelled:    number;
  active:       number;
  complete:     number;
  hold:         number;
  open:         number;
  due_active:   number;
  due_complete: number;
  overdue:      number;
  plan_pct:     number | null;
  ytd_pct:      number | null;
}

export interface PmpKpis {
  total_year:         number;
  total_month:        number;
  completed_month:    number;
  pending_month:      number;
  unclassified_month: number;
  by_month:           PmpMonthCount[];
  by_bu_month:        PmpBuCount[];
  by_bu_year:         PmpBuCount[];
  year_stats?:        Record<string, PmpYearStats>;
}

export interface PmpCalendarResponse {
  year:          number;
  month:         number;
  days_in_month: number;
  as_of?:        string;
  kpis:          PmpKpis;
  days:          PmpDayCell[];
  events:        PmpEvent[];
}

export interface DayBucket {
  key:       string;
  day:       number;
  total:     number;
  complete:  number;
  open:      number;
  hold:      number;
  cancelled: number;
}

export type PmStatus = "complete" | "open" | "hold" | "cancelled";

export const PM = {
  accent:       "#E0842D",
  accentSoft:   "rgba(224,132,45,0.22)",
  accentFaint:  "rgba(224,132,45,0.10)",
  success:      "#12876F",
  successSoft:  "rgba(18,135,111,0.15)",
  hold:         "#B45309",
  holdSoft:     "rgba(180,83,9,0.15)",
  danger:       "#B91C1C",
  mono:         "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const BU_COLORS: Record<string, string> = {
  volvo:        "#2563eb",
  cummins:      "#dc2626",
  tulc:         "#059669",
  unclassified: "#94a3b8",
};

/** Normaliza el valor de BU que manda el backend a una llave estable en minusculas. */
export function buKey(bu: string | null | undefined): string {
  return (bu || "unclassified").toLowerCase();
}

export function buColor(bu: string): string {
  return BU_COLORS[buKey(bu)] ?? "#64748b";
}

/**
 * Estados reales confirmados en Plex (sesion 2026-08-03):
 * Complete, Open, Hold, Cancelled. Cualquier valor no reconocido cae a "open"
 * para que aparezca como pendiente en vez de desaparecer del conteo.
 *
 * El backend ya manda status_norm con esta misma logica; esta funcion queda
 * como fallback para respuestas viejas en cache del navegador.
 */
export function normalizeStatus(raw: string): PmStatus {
  const s = (raw || "").toLowerCase();
  if (s.includes("cancel"))   return "cancelled";
  if (s.includes("complet"))  return "complete";
  if (s.includes("hold"))     return "hold";
  return "open";
}

export function eventStatus(ev: { status: string; status_norm?: PmStatus }): PmStatus {
  return ev.status_norm ?? normalizeStatus(ev.status);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}