export type Priority = "high" | "medium" | "low";

export type CAStatus =
  | "open"
  | "in_progress"
  | "pending_validation"
  | "on_hold"
  | "closed"
  | "cancelled";

export interface CAComment {
  id:              number;
  text:            string;
  created_by:      number;
  created_by_name: string;
  created_at:      string;
}

export interface CAHistory {
  id:              number;
  field:           string;
  old_value:       string;
  new_value:       string;
  changed_by_name: string;
  changed_at:      string;
}

export interface CorrectiveAction {
  id:                number;
  title:             string;
  description:       string;
  priority:          Priority;
  status:            CAStatus;
  equipment_id:      string;
  equipment_desc:    string;
  equipment_group:   string;
  root_cause:        string;
  failure_type:      string;
  corrective_action: string;
  assigned_to:       number | null;
  assigned_to_name:  string;
  due_date:          string | null;
  close_notes:       string;
  closed_by:         number | null;
  closed_by_name:    string;
  closed_at:         string | null;
  created_by:        number;
  created_by_name:   string;
  is_overdue:        boolean;
  cycle_time_days:   number | null;
  created_at:        string;
  updated_at:        string;
  comments:          CAComment[];
  history:           CAHistory[];
}

export interface EquipmentItem {
  Equipment_Key:   number;
  Equipment_ID:    string;
  Description:     string;
  Equipment_Group: string;
  Workcenter:      string;
}

export interface AssigneeItem {
  id:   number;
  name: string;
  role: string;
}

export interface CAFormData {
  title:             string;
  description:       string;
  priority:          Priority;
  equipment_id:      string;
  equipment_desc:    string;
  equipment_group:   string;
  root_cause:        string;
  failure_type:      string;
  corrective_action: string;
  assigned_to:       number | null;
  due_date:          string | null;
  close_notes:       string;
  status:            CAStatus;
}

export interface CAMetrics {
  total:            number;
  overdue:          number;
  avg_cycle_days:   number | null;
  by_status:        { status: CAStatus; count: number }[];
  by_priority:      { priority: Priority; count: number }[];
  top_equipment:    { equipment_id: string; equipment_desc: string; count: number }[];
}

// Transiciones válidas por estado
export const VALID_TRANSITIONS: Record<CAStatus, CAStatus[]> = {
  open:               ["in_progress", "cancelled"],
  in_progress:        ["pending_validation", "on_hold", "cancelled"],
  pending_validation: ["closed", "in_progress"],
  on_hold:            ["in_progress", "cancelled"],
  closed:             [],
  cancelled:          [],
};