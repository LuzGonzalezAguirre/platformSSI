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

export type AttendanceStatus = "present" | "absent" | "leave" | "sick";
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

export const STATUS_LABELS: Record<AttendanceStatus, { es: string; en: string }> = {
  present: { es: "Presente",          en: "Present"  },
  absent:  { es: "Ausente",           en: "Absent"   },
  leave:   { es: "Permiso",           en: "Leave"    },
  sick:    { es: "Incapacidad",       en: "Sick"     },
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "#10b981",
  absent:  "#ef4444",
  leave:   "#f59e0b",
  sick:    "#6366f1",
};

export const SHIFT_LABELS: Record<AttendanceShift, { es: string; en: string }> = {
  full:     { es: "Completo",  en: "Full"     },
  partial:  { es: "Parcial",   en: "Partial"  },
  overtime: { es: "Tiempo Extra", en: "Overtime" },
  none:     { es: "—",         en: "—"        },
};

export const DEFAULT_HOURS: Record<AttendanceShift, number> = {
  full:     12,
  partial:  4,
  overtime: 10,
  none:     0,
};