export interface WorkRequest {
  work_request_no:       string;
  description:           string;
  request_date:          string;
  due_date:              string;
  completed_date:        string | null;
  status:                string;
  type:                  string;
  assigned_to:           string;
  equipment_id:          string;
  equipment_description: string;
  equipment_group:       string;
  department:            string;
  scheduled_hours:       number;
  maintenance_hours:     number;
  failure:               string;
  failure_type:          string;
  failure_action:        string;
}

export interface WRKpis {
  total_wr:          number;
  total_scheduled:   number;   // horas planeadas totales
  total_maintenance: number;   // horas reales totales
  completed_pct:     number;
  pending_count:     number;
  avg_scheduled:     number;
  avg_maintenance:   number;
  efficiency:        number | null;  // % planeado/real
  top_failure:       string;
  avg_lead_time:     number | null;
  backlog:           number;
}

export interface GroupedItem {
  label: string;
  count: number;
  hours: number;
}

export interface DayItem {
  date:  string;
  count: number;
  hours: number;
}

export interface EquipmentGridItem {
  equipment_id:    string;
  description:     string;
  group:           string;
  department:      string;
  count:           number;
  hours:           number;
  dominant_status: string;
  statuses:        Record<string, number>;
}

export interface WRDashboard {
  rows:           WorkRequest[];
  kpis:           WRKpis;
  by_status:      GroupedItem[];
  by_type:        GroupedItem[];
  by_equipment:   GroupedItem[];
  by_technician:  GroupedItem[];
  by_failure:     GroupedItem[];
  by_day:         DayItem[];
  by_department:  GroupedItem[];
  equipment_grid: EquipmentGridItem[];
}

export interface DateRange {
  start: string;
  end:   string;
}