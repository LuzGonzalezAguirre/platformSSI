export type DatePreset =
  | "today" | "yesterday"
  | "current_week" | "next_week" | "previous_week" | "last_7_days"
  | "month_to_date" | "current_month" | "previous_month"
  | "next_30_days" | "last_30_days" | "last_60_days" | "last_90_days"
  | "year_to_date" | "last_26_weeks" | "last_52_weeks"
  | "custom";

export interface DateRange {
  start: string;
  end: string;
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Lunes de la semana que contiene `d` (misma lógica que OEETrendChart.tsx groupData)
function mondayOf(d: Date): Date {
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export function resolvePreset(preset: Exclude<DatePreset, "custom">): DateRange {
  const now = new Date();

  switch (preset) {
    case "today":
      return { start: fmt(now), end: fmt(now) };

    case "yesterday": {
      const y = addDays(now, -1);
      return { start: fmt(y), end: fmt(y) };
    }

    case "current_week":
      // Hasta hoy, no domingo — consistente con los datos reales disponibles.
      return { start: fmt(mondayOf(now)), end: fmt(now) };

    case "next_week": {
      const nextMonday = addDays(mondayOf(now), 7);
      return { start: fmt(nextMonday), end: fmt(addDays(nextMonday, 6)) };
    }

    case "previous_week": {
      const prevMonday = addDays(mondayOf(now), -7);
      return { start: fmt(prevMonday), end: fmt(addDays(prevMonday, 6)) };
    }

    case "last_7_days":
      return { start: fmt(addDays(now, -7)), end: fmt(now) };

    case "month_to_date": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(first), end: fmt(now) };
    }

    case "current_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: fmt(first), end: fmt(last) };
    }

    case "previous_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(first), end: fmt(last) };
    }

    case "next_30_days":
      return { start: fmt(now), end: fmt(addDays(now, 30)) };

    case "last_30_days":
      return { start: fmt(addDays(now, -30)), end: fmt(now) };

    case "last_60_days":
      return { start: fmt(addDays(now, -60)), end: fmt(now) };

    case "last_90_days":
      return { start: fmt(addDays(now, -90)), end: fmt(now) };

    // ── rangos largos (tendencias semanales, ej. Scrap Rate) ──────────
    // Alineados a lunes ISO, igual que iso_week_spine() en el backend --
    // el backend expande a semana completa de todas formas, pero mandar
    // ya el lunes evita que el "requested range" mostrado difiera del
    // rango efectivo por unos dias.

    case "year_to_date": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { start: fmt(first), end: fmt(now) };
    }

    case "last_26_weeks":
      return { start: fmt(addDays(mondayOf(now), -26 * 7)), end: fmt(now) };

    case "last_52_weeks":
      return { start: fmt(addDays(mondayOf(now), -52 * 7)), end: fmt(now) };
  }
}