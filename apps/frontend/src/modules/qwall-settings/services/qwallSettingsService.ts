import apiClient from "../../../services/api.client";
import type {
  BusinessUnit, QWallRole, QWallUser, PartNumber,
  InspectionPoint, FailMode, SystemConfig,
  PartNumberScanRule, PartNumberLookup,
} from "../types";

const BASE = "/quality/qwall/settings";

// ── Catalogs ──────────────────────────────────────────────────────────────────

export const fetchBusinessUnits = () =>
  apiClient.get<{ data: BusinessUnit[] }>(`${BASE}/business-units/`).then(r => r.data.data);

export const fetchQWallRoles = () =>
  apiClient.get<{ data: QWallRole[] }>(`${BASE}/qwall-roles/`).then(r => r.data.data);

// ── Users ─────────────────────────────────────────────────────────────────────

export const fetchUsers = () =>
  apiClient.get<{ data: QWallUser[] }>(`${BASE}/users/`).then(r => r.data.data);

export const createUser = (body: { name: string; barcode_id: string; password_hash: string; role_id: number }) =>
  apiClient.post<QWallUser>(`${BASE}/users/`, body).then(r => r.data);

export const updateUser = (
  user_id: number,
  body: Partial<{ name: string; barcode_id: string; password_hash: string; role_id: number; is_active: number }>,
) => apiClient.patch<QWallUser>(`${BASE}/users/${user_id}/`, body).then(r => r.data);

export const deactivateUser = (user_id: number) =>
  apiClient.delete<QWallUser>(`${BASE}/users/${user_id}/`).then(r => r.data);

// ── Part Numbers ──────────────────────────────────────────────────────────────

export const fetchPartNumbers = (bu_id?: number) =>
  apiClient
    .get<{ data: PartNumber[] }>(`${BASE}/part-numbers/`, { params: bu_id ? { bu_id } : undefined })
    .then(r => r.data.data);

export const createPartNumber = (body: { ssiPN: string; volvoProductNumber: string; bu_id: number }) =>
  apiClient.post<PartNumber>(`${BASE}/part-numbers/`, body).then(r => r.data);

export const updatePartNumber = (
  pn_id: number,
  body: Partial<{ ssiPN: string; volvoProductNumber: string; bu_id: number }>,
) => apiClient.patch<PartNumber>(`${BASE}/part-numbers/${pn_id}/`, body).then(r => r.data);

export const deletePartNumber = (pn_id: number) =>
  apiClient.delete<PartNumber>(`${BASE}/part-numbers/${pn_id}/`).then(r => r.data);

// ── Inspection Points ─────────────────────────────────────────────────────────

export const fetchInspectionPoints = (bu_id?: number) =>
  apiClient
    .get<{ data: InspectionPoint[] }>(`${BASE}/inspection-points/`, { params: bu_id ? { bu_id } : undefined })
    .then(r => r.data.data);

export const createInspectionPoint = (body: { point_name: string; bu_id: number; sequence_order: number }) =>
  apiClient.post<InspectionPoint>(`${BASE}/inspection-points/`, body).then(r => r.data);

export const updateInspectionPoint = (
  point_id: number,
  body: Partial<{ point_name: string; bu_id: number; sequence_order: number; is_active: number }>,
) => apiClient.patch<InspectionPoint>(`${BASE}/inspection-points/${point_id}/`, body).then(r => r.data);

export const deactivateInspectionPoint = (point_id: number) =>
  apiClient.delete<InspectionPoint>(`${BASE}/inspection-points/${point_id}/`).then(r => r.data);

// ── Fail Modes ────────────────────────────────────────────────────────────────

export const fetchFailModes = (bu_id?: number, point_id?: number) => {
  const params: Record<string, number> = {};
  if (bu_id)    params.bu_id    = bu_id;
  if (point_id) params.point_id = point_id;
  return apiClient
    .get<{ data: FailMode[] }>(`${BASE}/fail-modes/`, { params: Object.keys(params).length ? params : undefined })
    .then(r => r.data.data);
};

export const createFailMode = (body: { fail_code: string; description: string }) =>
  apiClient.post<FailMode>(`${BASE}/fail-modes/`, body).then(r => r.data);

export const updateFailMode = (
  fail_mode_id: number,
  body: Partial<{ fail_code: string; description: string; is_active: number }>,
) => apiClient.patch<FailMode>(`${BASE}/fail-modes/${fail_mode_id}/`, body).then(r => r.data);

export const deactivateFailMode = (fail_mode_id: number) =>
  apiClient.delete<FailMode>(`${BASE}/fail-modes/${fail_mode_id}/`).then(r => r.data);

export const assignFailModePoints = (fail_mode_id: number, point_ids: number[]) =>
  apiClient
    .post(`${BASE}/fail-modes/${fail_mode_id}/assign-points/`, { point_ids })
    .then(r => r.data);

// ── System Config ─────────────────────────────────────────────────────────────

export const fetchSystemConfig = () =>
  apiClient.get<{ data: SystemConfig[] }>(`${BASE}/system-config/`).then(r => r.data.data);

export const updateSystemConfig = (config_key: string, value: string) =>
  apiClient.patch<SystemConfig>(`${BASE}/system-config/${config_key}/`, { value }).then(r => r.data);

// ── Scan Rules ────────────────────────────────────────────────────────────────

const SCAN_BASE = "/quality/scan-rules";

export const fetchScanRules = (bu_id?: number, is_active?: boolean) => {
  const params: Record<string, string | number> = {};
  if (bu_id    !== undefined) params.bu_id    = bu_id;
  if (is_active !== undefined) params.is_active = is_active ? "true" : "false";
  return apiClient
    .get<PartNumberScanRule[]>(`${SCAN_BASE}/`, { params: Object.keys(params).length ? params : undefined })
    .then(r => r.data);
};

export const fetchScanRuleByPn = (pn_id: number) =>
  apiClient
    .get<PartNumberScanRule[]>(`${SCAN_BASE}/`, { params: { pn_id } })
    .then(r => r.data[0] ?? null);

export const fetchScanRule = (id: number) =>
  apiClient.get<PartNumberScanRule>(`${SCAN_BASE}/${id}/`).then(r => r.data);

export const createScanRule = (data: Omit<PartNumberScanRule, 'id'>) =>
  apiClient.post<PartNumberScanRule>(`${SCAN_BASE}/`, data).then(r => r.data);

export const updateScanRule = (id: number, data: Partial<PartNumberScanRule>) =>
  apiClient.patch<PartNumberScanRule>(`${SCAN_BASE}/${id}/`, data).then(r => r.data);

export const toggleScanRule = (id: number) =>
  apiClient.patch<{ id: number; is_active: boolean }>(`${SCAN_BASE}/${id}/toggle/`).then(r => r.data);

export const deleteScanRule = (id: number) =>
  apiClient.delete(`${SCAN_BASE}/${id}/`).then(() => undefined);

export const fetchPartNumberLookup = (bu_id?: number) => {
  const params = bu_id !== undefined ? { bu_id } : undefined;
  return apiClient
    .get<{ data: PartNumberLookup[] }>(`${SCAN_BASE}/pn-lookup/`, { params })
    .then(r => r.data.data);
};
