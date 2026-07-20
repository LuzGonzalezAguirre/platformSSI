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
  operation_no: number;
  container_count: number;
  total_quantity: string | number;
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
