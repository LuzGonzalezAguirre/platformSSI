// apps/frontend/src/modules/quality/problem-control/api/problemApi.ts

import apiClient from "../../../../services/api.client";
import type {
  Problem,
  ProblemListItem,
  ProblemCreateRequest,
  ProblemUpdateRequest,
  ProblemFilters,
  ApproveRequest,
  RejectRequest,
  OverrideRequest,
  SeverityLevel,
  DefectType,
  UserBasic,
  ContainmentAction,
} from '../types/problem.types';

export const problemApi = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CATALOGS
  // ═══════════════════════════════════════════════════════════════════════════
  getSeverityLevels: async (): Promise<SeverityLevel[]> => {
    const response = await apiClient.get('/quality/severity-levels/');
    return response.data;
  },

  getDefectTypes: async (): Promise<DefectType[]> => {
    const response = await apiClient.get('/quality/defect-types/');
    return response.data;
  },

  getQualityUsers: async (): Promise<UserBasic[]> => {
    const response = await apiClient.get('/quality/quality-users/');
    return response.data;
  },

  getQualityManagers: async (): Promise<UserBasic[]> => {
    const response = await apiClient.get('/quality/quality-managers/');
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  getAll: async (filters?: ProblemFilters): Promise<ProblemListItem[]> => {
    const response = await apiClient.get('/quality/problems/', { params: filters });
    return response.data;
  },

  getById: async (id: number): Promise<Problem> => {
    const response = await apiClient.get(`/quality/problems/${id}/`);
    return response.data;
  },

  create: async (data: ProblemCreateRequest): Promise<Problem> => {
    const response = await apiClient.post('/quality/problems/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<ProblemUpdateRequest>): Promise<Problem> => {
    const response = await apiClient.put(`/quality/problems/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/problems/${id}/`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════
  submit: async (id: number): Promise<Problem> => {
    const response = await apiClient.post(`/quality/problems/${id}/submit/`);
    return response.data;
  },

  approve: async (id: number, data: ApproveRequest): Promise<Problem> => {
    const response = await apiClient.post(`/quality/problems/${id}/approve/`, data);
    return response.data;
  },

  reject: async (id: number, data: RejectRequest): Promise<Problem> => {
    const response = await apiClient.post(`/quality/problems/${id}/reject/`, data);
    return response.data;
  },

  close: async (id: number): Promise<Problem> => {
    const response = await apiClient.post(`/quality/problems/${id}/close/`);
    return response.data;
  },

  requestOverride: async (id: number, data: OverrideRequest): Promise<Problem> => {
    const response = await apiClient.post(`/quality/problems/${id}/override/request/`, data);
    return response.data;
  },

  approveOverride: async (id: number): Promise<Problem> => {
    const response = await apiClient.post(`/quality/problems/${id}/override/approve/`);
    return response.data;
  },
  getContainmentActions: async (problemId: number): Promise<ContainmentAction[]> => {
    const response = await apiClient.get('/quality/containment-actions/', {
      params: { problem_id: problemId },
    });
    return response.data;
  },

  createContainmentAction: async (data: Omit<ContainmentAction, 'id'>): Promise<ContainmentAction> => {
    const response = await apiClient.post('/quality/containment-actions/', data);
    return response.data;
  },

  updateContainmentAction: async (id: number, data: Partial<ContainmentAction>): Promise<ContainmentAction> => {
    const response = await apiClient.put(`/quality/containment-actions/${id}/`, data);
    return response.data;
  },

  deleteContainmentAction: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/containment-actions/${id}/`);
  },
};