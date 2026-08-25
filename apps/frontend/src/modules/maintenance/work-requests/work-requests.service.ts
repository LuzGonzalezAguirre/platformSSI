import apiClient from "../../../services/api.client";
import { WRDashboard } from "./types";

interface StandardFilterParams {
  bu?: string[];
  workcenter?: string[];
}

export const WorkRequestsService = {
  getDashboard: (start: string, end: string, filters?: StandardFilterParams): Promise<WRDashboard> =>
    apiClient
      .get("/maintenance/work-requests/dashboard/", {
        params: {
          start_date: start,
          end_date: end,
          bu: filters?.bu,
          workcenter: filters?.workcenter,
        },
      })
      .then((r: any) => r.data),
};