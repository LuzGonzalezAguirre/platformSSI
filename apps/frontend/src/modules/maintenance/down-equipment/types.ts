export type DownSeverity = "normal" | "warning" | "high" | "critical";

export interface DownEquipmentItem {
  equipment_id: string;
  equipment_description: string;
  workcenter: string;
  workcenter_group: string;
  bu: string;
  status: string;
  reason: string;
  notes: string;
  started_at: string;
  elapsed_minutes: number;
  logged_hours: number;
  severity: DownSeverity;
}

export interface DownTrendDay {
  date: string;
  hours: number;
  events: number;
}

export interface DownTrendBu {
  bu: string;
  hours: number;
  events: number;
}

export interface RecurrentEquipment {
  equipment_id: string;
  description: string;
  hours: number;
  events: number;
}

export interface DownEquipmentDashboard {
  as_of: string;
  range_days: number;
  rows: DownEquipmentItem[];
  kpis: {
    currently_down: number;
    critical: number;
    longest_minutes: number;
    longest_equipment: string | null;
    most_affected_bu: string | null;
  };
  trends: {
    by_day: DownTrendDay[];
    by_bu: DownTrendBu[];
    recurrent: RecurrentEquipment[];
  };
}
