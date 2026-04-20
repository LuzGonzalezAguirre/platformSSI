import apiClient from "../../../services/api.client";

export interface QualityTarget {
  id: number;
  level: "bu" | "workcenter";
  bu: string | null;
  workcenter_name: string | null;
  yield_min_pct: string;
  scrap_max_pct: string;
  updated_at: string;
}

export interface ScrapDetailParams {
  start_date: string;
  end_date:   string;
  use_shift?: boolean;
}

const BASE = "/quality";

export const QualityService = {
  getScrapDetail: (params: ScrapDetailParams) =>
    apiClient
      .get(`${BASE}/scrap-detail/`, { params: { ...params, use_shift: params.use_shift ?? true } })
      .then((r: any) => r.data),

  getTargets: (): Promise<QualityTarget[]> =>
    apiClient.get(`${BASE}/targets/`).then((r: any) => r.data),

  saveTarget: (payload: Omit<QualityTarget, "id" | "updated_at">) =>
    apiClient.post(`${BASE}/targets/`, payload).then((r: any) => r.data),

  updateTarget: (id: number, payload: Partial<QualityTarget>) =>
    apiClient.put(`${BASE}/targets/${id}/`, payload).then((r: any) => r.data),

  deleteTarget: (id: number) =>
    apiClient.delete(`${BASE}/targets/${id}/`),

  resolveTarget: (
    targets: QualityTarget[],
    bu: string,
    workcenter: string,
  ): { yield_min_pct: number; scrap_max_pct: number } => {
    const wcTarget = targets.find(
      (t) => t.level === "workcenter" && t.workcenter_name === workcenter,
    );
    if (wcTarget) return {
      yield_min_pct: parseFloat(wcTarget.yield_min_pct),
      scrap_max_pct: parseFloat(wcTarget.scrap_max_pct),
    };
    const buTarget = targets.find((t) => t.level === "bu" && t.bu === bu);
    if (buTarget) return {
      yield_min_pct: parseFloat(buTarget.yield_min_pct),
      scrap_max_pct: parseFloat(buTarget.scrap_max_pct),
    };
    return { yield_min_pct: 95, scrap_max_pct: 2 };
  },
};