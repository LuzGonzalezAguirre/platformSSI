export interface BusinessUnit {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface WeeklyTarget {
  id: number;
  business_unit_code: string;
  business_unit_name: string;
  week_start: string;
  general_target: number;
  monday:    number | null;
  tuesday:   number | null;
  wednesday: number | null;
  thursday:  number | null;
  friday:    number | null;
  saturday:  number | null;
  sunday:    number | null;
  updated_at: string;
}

export interface WeeklyWIP {
  id: number;
  business_unit_code: string;
  week_start: string;
  general_actual: number;
  general_goal:   number;
  monday_actual:    number | null;
  monday_goal:      number | null;
  tuesday_actual:   number | null;
  tuesday_goal:     number | null;
  wednesday_actual: number | null;
  wednesday_goal:   number | null;
  thursday_actual:  number | null;
  thursday_goal:    number | null;
  friday_actual:    number | null;
  friday_goal:      number | null;
  saturday_actual:  number | null;
  saturday_goal:    number | null;
  sunday_actual:    number | null;
  sunday_goal:      number | null;
  updated_at: string;
}

export interface WeeklyTargetPayload {
  week_date: string;
  bu_code:   string;
  general_target: number;
  monday?:    number | null;
  tuesday?:   number | null;
  wednesday?: number | null;
  thursday?:  number | null;
  friday?:    number | null;
  saturday?:  number | null;
  sunday?:    number | null;
}

export interface WeeklyWIPPayload {
  week_date:      string;
  bu_code:        string;
  general_actual: number;
  general_goal:   number;
  monday_actual?:    number | null;
  monday_goal?:      number | null;
  tuesday_actual?:   number | null;
  tuesday_goal?:     number | null;
  wednesday_actual?: number | null;
  wednesday_goal?:   number | null;
  thursday_actual?:  number | null;
  thursday_goal?:    number | null;
  friday_actual?:    number | null;
  friday_goal?:      number | null;
  saturday_actual?:  number | null;
  saturday_goal?:    number | null;
  sunday_actual?:    number | null;
  sunday_goal?:      number | null;
}

export const DAY_KEYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;

export type DayKey = typeof DAY_KEYS[number];

export const DAY_LABELS: Record<DayKey, { es: string; en: string }> = {
  monday:    { es: "Lunes",     en: "Monday"    },
  tuesday:   { es: "Martes",    en: "Tuesday"   },
  wednesday: { es: "Miércoles", en: "Wednesday" },
  thursday:  { es: "Jueves",    en: "Thursday"  },
  friday:    { es: "Viernes",   en: "Friday"    },
  saturday:  { es: "Sábado",    en: "Saturday"  },
  sunday:    { es: "Domingo",   en: "Sunday"    },
};