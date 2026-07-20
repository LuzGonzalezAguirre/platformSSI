import apiClient from "../../../services/api.client";
import { DashboardTarget } from "./types";

const BASE = "/maintenance/overview/targets/";

export const DashboardTargetsService = {
  getTargets: (): Promise<DashboardTarget[]> =>
    apiClient.get(BASE).then((r: any) => r.data),

  updateTargets: (items: { metric_key: string; target_value: number }[]): Promise<DashboardTarget[]> =>
    apiClient.put(BASE, { items }).then((r: any) => r.data),
};
