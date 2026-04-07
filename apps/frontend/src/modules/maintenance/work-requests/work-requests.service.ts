import apiClient from "../../../services/api.client";
import { WRDashboard } from "./types";

export const WorkRequestsService = {
  getDashboard: (start: string, end: string): Promise<WRDashboard> =>
    apiClient
      .get("/maintenance/work-requests/dashboard/", { params: { start_date: start, end_date: end } })
      .then((r: any) => r.data),
};