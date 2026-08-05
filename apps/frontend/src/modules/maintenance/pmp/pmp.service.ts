import apiClient from "../../../services/api.client";
import { PmpCalendarResponse } from "./types";

export const PmpService = {
  getCalendar: (year: number, month: number): Promise<PmpCalendarResponse> =>
    apiClient
      .get("/maintenance/pmp/calendar/", { params: { year, month } })
      .then((r: any) => r.data),
};