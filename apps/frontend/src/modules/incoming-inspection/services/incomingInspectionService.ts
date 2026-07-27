import apiClient from "../../../services/api.client";
import type {
  IncomingInspectionFilters, IncomingInspectionKPIs,
  IncomingContainerHistoryRow, PaginatedResponse, SLAConfig,
  RejectionComment,
} from "../types";

const BASE = "/quality/incoming-inspection";

function toParams(filters: IncomingInspectionFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  (Object.entries(filters) as [string, string | number | undefined][]).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params[k] = v;
  });
  return params;
}

export const fetchKPIs = (filters: IncomingInspectionFilters) =>
  apiClient.get<IncomingInspectionKPIs>(`${BASE}/kpis/`, { params: toParams(filters) }).then(r => r.data);

export const fetchDetail = (
  filters: IncomingInspectionFilters, page: number, pageSize: number, ordering: string,
) =>
  apiClient
    .get<PaginatedResponse<IncomingContainerHistoryRow>>(`${BASE}/detail/`, {
      params: { ...toParams(filters), page, page_size: pageSize, ordering },
    })
    .then(r => r.data);

export const fetchRejectedLots = (
  filters: IncomingInspectionFilters, page: number, pageSize: number,
) =>
  apiClient
    .get<PaginatedResponse<IncomingContainerHistoryRow>>(`${BASE}/rejected-lots/`, {
      params: { ...toParams(filters), page, page_size: pageSize },
    })
    .then(r => r.data);

export const fetchRejectionComments = (serialNo: string) =>
  apiClient.get<RejectionComment[]>(`${BASE}/rejected-lots/${encodeURIComponent(serialNo)}/comments/`).then(r => r.data);

export const postRejectionComment = (serialNo: string, comment: string) =>
  apiClient
    .post<RejectionComment>(`${BASE}/rejected-lots/${encodeURIComponent(serialNo)}/comments/`, { comment })
    .then(r => r.data);

export const fetchUserNames = (userNos: number[]) =>
  apiClient
    .post<Record<string, string>>(`${BASE}/user-lookup/`, { user_nos: userNos })
    .then(r => r.data);

export const fetchSLAConfig = () =>
  apiClient.get<SLAConfig>(`${BASE}/sla-config/`).then(r => r.data);

export const updateSLAConfig = (threshold_hours: number) =>
  apiClient.patch<SLAConfig>(`${BASE}/sla-config/`, { threshold_hours }).then(r => r.data);