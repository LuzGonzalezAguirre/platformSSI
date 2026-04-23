import apiClient from "../../../services/api.client";
import {
  CorrectiveAction, CAFormData, EquipmentItem,
  AssigneeItem, CAMetrics, CAStatus,
} from "./types";

const BASE = "/maintenance";

export const CAService = {
  list: (filters?: {
    status?: string; priority?: string; equipment_id?: string; assigned_to?: number;
  }): Promise<CorrectiveAction[]> =>
    apiClient.get(`${BASE}/corrective-actions/`, { params: filters }).then((r: any) => r.data),

  get: (id: number): Promise<CorrectiveAction> =>
    apiClient.get(`${BASE}/corrective-actions/${id}/`).then((r: any) => r.data),

  create: (data: Partial<CAFormData>): Promise<CorrectiveAction> =>
    apiClient.post(`${BASE}/corrective-actions/`, data).then((r: any) => r.data),

  update: (id: number, data: Partial<CAFormData>): Promise<CorrectiveAction> =>
    apiClient.patch(`${BASE}/corrective-actions/${id}/`, data).then((r: any) => r.data),

  transition: (id: number, status: CAStatus, extra?: Partial<CAFormData>): Promise<CorrectiveAction> =>
    apiClient.patch(`${BASE}/corrective-actions/${id}/`, { status, ...extra }).then((r: any) => r.data),

  delete: (id: number): Promise<void> =>
    apiClient.delete(`${BASE}/corrective-actions/${id}/`).then(() => undefined),

  addComment: (id: number, text: string): Promise<{ id: number; text: string; created_by_name: string; created_at: string }> =>
    apiClient.post(`${BASE}/corrective-actions/${id}/comments/`, { text }).then((r: any) => r.data),

  getMetrics: (): Promise<CAMetrics> =>
    apiClient.get(`${BASE}/corrective-actions/metrics/`).then((r: any) => r.data),

  getEquipment: (): Promise<EquipmentItem[]> =>
    apiClient.get(`${BASE}/equipment-catalog/`).then((r: any) => r.data.data ?? []),

  getAssignees: (): Promise<AssigneeItem[]> =>
    apiClient.get(`${BASE}/assignee-catalog/`).then((r: any) => r.data),
};