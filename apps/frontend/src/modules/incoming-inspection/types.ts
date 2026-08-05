export interface IncomingInspectionFilters {
  date_from?: string;
  date_to?: string;
  part_no?: string;
  operation_no?: number;
  location?: string;
  container_status?: string;
  defect_type?: string;
  sla_status?: "on_time" | "late";
}

export interface OperationCount {
  operation_key: string;
  operation_name: string;
  lot_count: number;
}

export interface LotsInspected {
  total: number;
  by_operation: { operation_no: number; count: number }[];
}

export interface AcceptanceRate {
  total: number;
  accepted: number;
  rejected: number;
  acceptance_rate: number;
}

export interface SLADetailRow {
  serial_no: string;
  start: string;
  end: string;
  hours: number;
  sla_status: "on_time" | "late";
}

export interface SLACompliance {
  threshold_hours: number;
  on_time: number;
  late: number;
  compliance_rate: number;
  detail: SLADetailRow[];
}

export type SLASummary = Omit<SLACompliance, "detail">;

export interface IncomingInspectionKPIs {
  operation_counts: OperationCount[];
  lots_inspected: LotsInspected;
  acceptance_rate: AcceptanceRate;
  sla_compliance: SLACompliance;
}

export interface IncomingContainerHistoryRow {
  id: number;
  serial_no: string;
  part_no: string;
  operation_no: number;
  change_date: string;
  last_action: string | null;
  location: string | null;
  container_status: string | null;
  defect_type: string | null;
  note: string | null;
  change_by: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SLAConfig {
  threshold_hours: number;
}

export interface RejectionComment {
  id: number;
  serial_no: string;
  comment: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface DailyTrendPoint {
  date: string;
  inspected: number;
  accepted: number;
  rejected: number;
  rejection_rate: number;
}

export interface TopRejectedPart {
  part_no: string;
  total: number;
  rejected: number;
  rejection_rate: number;
}

export interface AgingBucket {
  key: "q1" | "q2" | "q3" | "over";
  min_hours: number;
  max_hours: number | null;
  breached: boolean;
  count: number;
}

export interface CycleTimeHistogram {
  threshold_hours: number;
  total: number;
  buckets: AgingBucket[];
  p50: number | null;
  p90: number | null;
  avg: number | null;
}

export interface IncomingDashboard {
  kpis: {
    operation_counts: OperationCount[];
    lots_inspected: LotsInspected;
    acceptance_rate: AcceptanceRate;
    sla_compliance: SLASummary;
  };
  daily_trend: DailyTrendPoint[];
  top_rejected_parts: TopRejectedPart[];
  cycle_time_histogram: CycleTimeHistogram;
}

export interface PendingRow extends IncomingContainerHistoryRow {
  waiting_hours: number;
  aging_bucket: AgingBucket["key"];
  sla_status: "on_time" | "late";
}

export interface PendingReconciliation {
  status: "ok" | "drift" | "no_snapshot";
  snapshot_total: number | null;
  history_total: number;
  delta: number | null;
  snapshot_quantity: string | null;
  snapshot_synced_at: string | null;
}

export interface PendingBacklog {
  threshold_hours: number;
  generated_at: string;
  count: number;
  truncated: boolean;
  summary: {
    total: number;
    on_time: number;
    late: number;
    oldest_hours: number | null;
    avg_hours: number | null;
    buckets: AgingBucket[];
  };
  reconciliation: PendingReconciliation;
  results: PendingRow[];
}