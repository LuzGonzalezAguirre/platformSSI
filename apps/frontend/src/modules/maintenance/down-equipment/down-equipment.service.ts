import apiClient from "../../../services/api.client";
import { DownEquipmentDashboard } from "./types";

export const DownEquipmentService = {
  getDashboard: (days: number, bu: string[] = []): Promise<DownEquipmentDashboard> =>
    apiClient
      .get("/maintenance/down-equipment/dashboard/", { params: { days, bu } })
      .then((response: any) => response.data),
};
