import { DateRange } from "./date-presets";

export interface StandardFilters extends DateRange {
  bu: string[];
  workcenter: string[];
  shift: string[];
}

export const EMPTY_STANDARD_FILTERS_EXTRA = {
  bu: [] as string[],
  workcenter: [] as string[],
  shift: [] as string[],
};