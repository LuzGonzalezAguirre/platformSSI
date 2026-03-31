import apiClient from "../../../services/api.client";
import {
  BusinessUnit, WeeklyTarget, WeeklyWIP,
  WeeklyTargetPayload, WeeklyWIPPayload,
} from "./types";

const BASE = "/production";

export const TargetsService = {
  getBusinessUnits: (): Promise<BusinessUnit[]> =>
    apiClient.get(`${BASE}/business-units/`).then((r: any) => r.data),

  getWeeklyTarget: (week: string, bu: string): Promise<WeeklyTarget | null> =>
    apiClient
      .get(`${BASE}/targets/weekly/`, { params: { week, bu } })
      .then((r: any) => (Object.keys(r.data).length === 0 ? null : r.data)),

  saveWeeklyTarget: (payload: WeeklyTargetPayload): Promise<WeeklyTarget> =>
    apiClient.post(`${BASE}/targets/weekly/`, payload).then((r: any) => r.data),

  getWeeklyWIP: (week: string, bu: string): Promise<WeeklyWIP | null> =>
    apiClient
      .get(`${BASE}/wip/weekly/`, { params: { week, bu } })
      .then((r: any) => (Object.keys(r.data).length === 0 ? null : r.data)),

  saveWeeklyWIP: (payload: WeeklyWIPPayload): Promise<WeeklyWIP> =>
    apiClient.post(`${BASE}/wip/weekly/`, payload).then((r: any) => r.data),
};