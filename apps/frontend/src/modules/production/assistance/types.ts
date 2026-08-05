export interface PlantEmployee {
  id: number;
  name: string;
  department: string;
  turno: "A" | "B";
  user_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: number | null;
  employee_id: number;
  employee_name: string;
  turno: "A" | "B";
  date: string;
  status: AttendanceStatus;
  shift: AttendanceShift;
  hours: string;
  recorded_at: string | null;
}

export type AttendanceStatus = "present" | "absent" | "vacation" | "leave" | "sick";
export type AttendanceShift  = "full" | "partial" | "overtime" | "none";

export interface PlantEmployeeCreatePayload {
  name: string;
  department: string;
  turno: "A" | "B";
}

export interface AttendanceBulkItem {
  employee_id: number;
  date: string;
  status: AttendanceStatus;
  shift: AttendanceShift;
  hours: number;
}

export interface AttendanceBulkPayload {
  records: AttendanceBulkItem[];
}

export const DEPARTMENTS = [
  "Assembly",
  "Machining",
  "Quality Control",
  "Packaging",
  "Maintenance",
  "Warehouse",
  "Engineering",
  "Administration",
];

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "vacation",
  "leave",
  "sick",
];

export const STATUS_LABELS: Record<AttendanceStatus, { es: string; en: string }> = {
  present:  { es: "Presente",    en: "Present"  },
  absent:   { es: "Ausente",     en: "Absent"   },
  vacation: { es: "Vacaciones",  en: "Vacation" },
  leave:    { es: "Permiso",     en: "Leave"    },
  sick:     { es: "Incapacidad", en: "Sick"     },
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present:  "#10b981",
  absent:   "#ef4444",
  vacation: "#0ea5e9",
  leave:    "#f59e0b",
  sick:     "#6366f1",
};

// Espejo de apps/production/services/attendance_policy.py
// El backend es la autoridad; esto solo evita que la UI muestre estados
// imposibles antes de guardar.
export const ZERO_HOUR_STATUSES: AttendanceStatus[] = ["absent", "vacation"];
export const PLANNED_ABSENCE_STATUSES: AttendanceStatus[] = ["vacation"];

export const isZeroHourStatus = (s: AttendanceStatus): boolean =>
  ZERO_HOUR_STATUSES.includes(s);

export const isPlannedAbsence = (s: AttendanceStatus): boolean =>
  PLANNED_ABSENCE_STATUSES.includes(s);

export const SHIFT_LABELS: Record<AttendanceShift, { es: string; en: string }> = {
  full:     { es: "Completo",     en: "Full"     },
  partial:  { es: "Parcial",      en: "Partial"  },
  overtime: { es: "Tiempo Extra", en: "Overtime" },
  none:     { es: "—",            en: "—"        },
};

export const DEFAULT_HOURS: Record<AttendanceShift, number> = {
  full:     11,
  partial:  6,
  overtime: 10,
  none:     0,
};

export interface DailyProductivity {
  date: string;
  turno: string | null;
  attendance_saved: boolean;
  paid_hours: string | null;
  earned_hours: string | null;
  productivity_pct: string | null;
  headcount_recorded: number;
  headcount_present: number;
  headcount_absent: number;
  notes: string;
  recorded_at: string | null;
}