export interface SafetySettings {
  id: number;
  plant: string;
  days_without_incident: number;
  last_incident_date: string | null;
  updated_at: string;
}

export interface SafetyIncident {
  id: number;
  incident_date: string;
  incident_type: IncidentType;
  severity: Severity;
  area: string;
  description: string;
  immediate_actions: string;
  root_cause: string;
  status: IncidentStatus;
  reported_by_name: string;
  created_at: string;
  updated_at: string;
}

export type IncidentType =
  | "near_miss"
  | "first_aid"
  | "recordable"
  | "lost_time"
  | "property_damage"
  | "environmental";

export type Severity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "in_progress" | "closed";

export interface SafetyIncidentCreatePayload {
  incident_date: string;
  incident_type: IncidentType;
  severity: Severity;
  area: string;
  description: string;
  immediate_actions?: string;
  root_cause?: string;
}

export interface SafetyIncidentFilters {
  type?: IncidentType;
  status?: IncidentStatus;
  severity?: Severity;
  date_from?: string;
  date_to?: string;
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, { es: string; en: string }> = {
  near_miss:       { es: "Casi Accidente", en: "Near Miss" },
  first_aid:       { es: "Primeros Auxilios", en: "First Aid" },
  recordable:      { es: "Registrable", en: "Recordable" },
  lost_time:       { es: "Tiempo Perdido", en: "Lost Time" },
  property_damage: { es: "Daño a Propiedad", en: "Property Damage" },
  environmental:   { es: "Ambiental", en: "Environmental" },
};

export const SEVERITY_LABELS: Record<Severity, { es: string; en: string }> = {
  low:      { es: "Bajo",     en: "Low"      },
  medium:   { es: "Medio",    en: "Medium"   },
  high:     { es: "Alto",     en: "High"     },
  critical: { es: "Crítico",  en: "Critical" },
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  low:      "#10b981",
  medium:   "#f59e0b",
  high:     "#ef4444",
  critical: "#7c3aed",
};

export const STATUS_LABELS: Record<IncidentStatus, { es: string; en: string }> = {
  open:        { es: "Abierto",      en: "Open"        },
  in_progress: { es: "En Progreso",  en: "In Progress" },
  closed:      { es: "Cerrado",      en: "Closed"      },
};

export const STATUS_COLORS: Record<IncidentStatus, string> = {
  open:        "#ef4444",
  in_progress: "#f59e0b",
  closed:      "#10b981",
};

export const AREAS = [
  "Production Floor",
  "Warehouse",
  "Assembly Line 1",
  "Assembly Line 2",
  "Quality Lab",
  "Maintenance Shop",
  "Office",
  "Parking Lot",
  "Other",
];

export const ROOT_CAUSES = [
  "Unsafe Act",
  "Unsafe Condition",
  "Equipment Failure",
  "Lack of Training",
  "PPE Not Used",
  "Procedure Not Followed",
  "Environmental Factor",
  "Other",
];