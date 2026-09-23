export interface ActionTrackerAction {
  item_id: number;
  code: string;
  title: string;
  state: string;
  progress: number;
  due_date: string | null;
  first_week_start: string;
  last_week_end: string;
  url: string;
  source: "scrap" | "maintenance";
  business_unit?: string;
  workcenter?: string;
  reason?: string;
  equipment_id?: string;
  equipment_description?: string;
  physical_area?: string;
}
