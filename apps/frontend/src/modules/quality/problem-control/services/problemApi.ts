/**
 * Problem Control API Service
 * Uses centralized API client from platformSSI
 */
import api from "../../../../services/api.client";
import type {
  ProblemListItem,
  ProblemDetail,
  ProblemCreateData,
  ProblemFilters,
  Stage,
  StageUpdateData,
  OverrideRequestData,
  AuditLogEntry,
  SLASettings,
} from '../types/problem.types';

const BASE_URL = '/quality';

export const problemApi = {
  // ========== PROBLEM CRUD ==========
  
  async list(filters?: ProblemFilters): Promise<ProblemListItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.created_by) params.append('created_by', filters.created_by.toString());
    
    const queryString = params.toString();
    const url = queryString ? `${BASE_URL}/problems/?${queryString}` : `${BASE_URL}/problems/`;
    
    const response = await api.get<ProblemListItem[]>(url);
    return response.data;
  },
  
  async detail(problemId: string): Promise<ProblemDetail> {
    const response = await api.get<ProblemDetail>(`${BASE_URL}/problems/${problemId}/`);
    return response.data;
  },
  
  async create(data: ProblemCreateData): Promise<ProblemDetail> {
    const response = await api.post<ProblemDetail>(`${BASE_URL}/problems/`, data);
    return response.data;
  },
  
  async update(problemId: string, data: Partial<ProblemCreateData>): Promise<ProblemDetail> {
    const response = await api.patch<ProblemDetail>(`${BASE_URL}/problems/${problemId}/`, data);
    return response.data;
  },
  
  async delete(problemId: string): Promise<void> {
    await api.delete(`${BASE_URL}/problems/${problemId}/`);
  },
  
  // ========== WORKFLOW ACTIONS ==========
  
  async submit(problemId: string): Promise<ProblemDetail> {
    const response = await api.post<ProblemDetail>(`${BASE_URL}/problems/${problemId}/submit/`, {});
    return response.data;
  },
  
  async approve(problemId: string): Promise<ProblemDetail> {
    const response = await api.post<ProblemDetail>(`${BASE_URL}/problems/${problemId}/approve/`, {});
    return response.data;
  },
  
  async reject(problemId: string, reason: string): Promise<ProblemDetail> {
    const response = await api.post<ProblemDetail>(
      `${BASE_URL}/problems/${problemId}/reject/`,
      { reason }
    );
    return response.data;
  },
  
  async close(problemId: string): Promise<ProblemDetail> {
    const response = await api.post<ProblemDetail>(`${BASE_URL}/problems/${problemId}/close/`, {});
    return response.data;
  },
  
  async getAuditLog(problemId: string): Promise<AuditLogEntry[]> {
    const response = await api.get<AuditLogEntry[]>(
      `${BASE_URL}/problems/${problemId}/audit-log/`
    );
    return response.data;
  },
  
  // ========== STAGES ==========
  
  async updateStage(stageId: string, data: StageUpdateData): Promise<Stage> {
    const response = await api.patch<Stage>(`${BASE_URL}/stages/${stageId}/`, data);
    return response.data;
  },
  
  async completeStage(stageId: string): Promise<Stage> {
    const response = await api.post<Stage>(`${BASE_URL}/stages/${stageId}/complete/`, {});
    return response.data;
  },
  
  async requestOverride(stageId: string, data: OverrideRequestData): Promise<Stage> {
    const response = await api.post<Stage>(
      `${BASE_URL}/stages/${stageId}/request-override/`,
      data
    );
    return response.data;
  },
  
  async approveOverride(stageId: string): Promise<Stage> {
    const response = await api.post<Stage>(
      `${BASE_URL}/stages/${stageId}/approve-override/`,
      {}
    );
    return response.data;
  },
  
  // ========== SLA SETTINGS ==========
  
  async getSLASettings(): Promise<SLASettings> {
    const response = await api.get<SLASettings>(`${BASE_URL}/sla-settings/`);
    return response.data;
  },
  
  async updateSLASettings(data: Partial<SLASettings>): Promise<SLASettings> {
    const response = await api.patch<SLASettings>(`${BASE_URL}/sla-settings/`, data);
    return response.data;
  },
};