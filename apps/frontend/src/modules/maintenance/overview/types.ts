export interface MaintenanceKPIs {
  operating_hours:  number;
  downtime_hours:   number;
  down_hours:       number;
  setup_hours:      number;
  idle_hours:       number;
  total_failures:   number;
  mttr_hours:       number | null;
  mtbf_hours:       number | null;
  availability_pct: number | null;
}

export interface DowntimeReason {
  reason:       string;
  total_events: number;
  total_hours:  number;
  percentage:   number;
}

export interface DowntimeDetail {
  Log_Date:              string;
  Log_Hours:             number;
  Status:                string;
  Reason:                string;
  Notes:                 string;
  Workcenter:            string;
  Shift:                 string | null;
  Part_No:               string | null;
  Operation_No:          string | null;
  Operation_Description: string | null;
  Job_No:                string | null;
}

export interface DateRange {
  start: string;  // YYYY-MM-DD
  end:   string;
}


export interface OEEData {
  date:             string;
  availability_pct: string;
  performance_pct:  string;
  quality_pct:      string;
  oee_pct:          string;
  recorded_at:      string;
}

export interface OEETrendPoint {
  date:            string;  // "2026-03"
  oee_pct:          number;
  availability_pct: number;
  performance_pct:  number;
  quality_pct:      number;
}

export interface DowntimeByMonth {
  date:        string;  // "2026-03"
  reason:       string;
  total_events: number;
  total_hours:  number;
}

export interface WRKpis {
  total_wr:       number;
  total_hours:    number;
  completed_pct:  number;
  pending_count:  number;
  avg_hours:      number;
  top_failure:    string;
  avg_lead_time:  number | null;  // ahora es MTTR en horas
  backlog:        number;         // Open WIs (todos los pending)
  overdue:        number;         // pending con due_date vencida
}