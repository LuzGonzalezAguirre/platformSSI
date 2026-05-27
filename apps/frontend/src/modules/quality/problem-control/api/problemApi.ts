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
  FiveWhyAnalysis,
  RootCause,
  CorrectiveAction,
  VerificationAction,
  PreventionAction,
  ProblemAttachment,
  ProblemNote,
  AttachmentStep,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // FIVE WHY ANALYSES (Step 4)
  // ═══════════════════════════════════════════════════════════════════════════
  getFiveWhyAnalyses: async (problemId: number): Promise<FiveWhyAnalysis[]> => {
    const response = await apiClient.get('/quality/five-why-analyses/', {
      params: { problem_id: problemId },
    });
    return response.data;
  },

  createFiveWhyAnalysis: async (data: { problem: number; category: FiveWhyAnalysis['category']; corrective_action?: string }): Promise<FiveWhyAnalysis> => {
    const response = await apiClient.post('/quality/five-why-analyses/', data);
    return response.data;
  },

  updateFiveWhyAnalysis: async (id: number, data: Partial<FiveWhyAnalysis>): Promise<FiveWhyAnalysis> => {
    const response = await apiClient.put(`/quality/five-why-analyses/${id}/`, data);
    return response.data;
  },

  deleteFiveWhyAnalysis: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/five-why-analyses/${id}/`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROOT CAUSES (Step 4 sub-resource)
  // ═══════════════════════════════════════════════════════════════════════════
  getRootCauses: async (fiveWhyId: number): Promise<RootCause[]> => {
    const response = await apiClient.get('/quality/root-causes/', {
      params: { five_why_id: fiveWhyId },
    });
    return response.data;
  },

  createRootCause: async (data: Omit<RootCause, 'id' | 'is_final' | 'created_at' | 'created_by' | 'root_cause'>): Promise<RootCause> => {
    const response = await apiClient.post('/quality/root-causes/', data);
    return response.data;
  },

  updateRootCause: async (id: number, data: Partial<RootCause>): Promise<RootCause> => {
    const response = await apiClient.put(`/quality/root-causes/${id}/`, data);
    return response.data;
  },

  deleteRootCause: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/root-causes/${id}/`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CORRECTIVE ACTIONS (Step 5)
  // ═══════════════════════════════════════════════════════════════════════════
  getCorrectiveActions: async (problemId: number): Promise<CorrectiveAction[]> => {
    const response = await apiClient.get('/quality/corrective-actions/', {
      params: { problem_id: problemId },
    });
    return response.data;
  },

  createCorrectiveAction: async (data: Omit<CorrectiveAction, 'id' | 'add_date' | 'responsible' | 'root_cause_description'>): Promise<CorrectiveAction> => {
    const response = await apiClient.post('/quality/corrective-actions/', data);
    return response.data;
  },

  updateCorrectiveAction: async (id: number, data: Partial<CorrectiveAction>): Promise<CorrectiveAction> => {
    const response = await apiClient.put(`/quality/corrective-actions/${id}/`, data);
    return response.data;
  },

  deleteCorrectiveAction: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/corrective-actions/${id}/`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION ACTIONS (Step 6)
  // ═══════════════════════════════════════════════════════════════════════════
  getVerificationActions: async (problemId: number): Promise<VerificationAction[]> => {
    const response = await apiClient.get('/quality/verification-actions/', {
      params: { problem_id: problemId },
    });
    return response.data;
  },

  createVerificationAction: async (data: Omit<VerificationAction, 'id' | 'add_date' | 'responsible'>): Promise<VerificationAction> => {
    const response = await apiClient.post('/quality/verification-actions/', data);
    return response.data;
  },

  updateVerificationAction: async (id: number, data: Partial<VerificationAction>): Promise<VerificationAction> => {
    const response = await apiClient.put(`/quality/verification-actions/${id}/`, data);
    return response.data;
  },

  deleteVerificationAction: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/verification-actions/${id}/`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVENTION ACTIONS (Step 7)
  // ═══════════════════════════════════════════════════════════════════════════
  getPreventionActions: async (problemId: number): Promise<PreventionAction[]> => {
    const response = await apiClient.get('/quality/prevention-actions/', {
      params: { problem_id: problemId },
    });
    return response.data;
  },

  createPreventionAction: async (data: Omit<PreventionAction, 'id' | 'add_date' | 'responsible'>): Promise<PreventionAction> => {
    const response = await apiClient.post('/quality/prevention-actions/', data);
    return response.data;
  },

  updatePreventionAction: async (id: number, data: Partial<PreventionAction>): Promise<PreventionAction> => {
    const response = await apiClient.put(`/quality/prevention-actions/${id}/`, data);
    return response.data;
  },

  deletePreventionAction: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/prevention-actions/${id}/`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTACHMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  getAttachments: async (problemId: number, step?: AttachmentStep): Promise<ProblemAttachment[]> => {
    const params: Record<string, any> = { problem_id: problemId };
    if (step) params.step = step;
    const response = await apiClient.get('/quality/attachments/', { params });
    return response.data;
  },

  uploadAttachment: async (problemId: number, step: AttachmentStep, file: File): Promise<ProblemAttachment> => {
    const formData = new FormData();
    formData.append('problem_id', String(problemId));
    formData.append('step', step);
    formData.append('file', file);
    const response = await apiClient.post('/quality/attachments/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteAttachment: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/attachments/${id}/`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTES
  // ═══════════════════════════════════════════════════════════════════════════
  getNotes: async (problemId: number, step?: AttachmentStep): Promise<ProblemNote[]> => {
    const params: Record<string, any> = { problem_id: problemId };
    if (step) params.step = step;
    const response = await apiClient.get('/quality/notes/', { params });
    return response.data;
  },

  createNote: async (problemId: number, step: AttachmentStep, text: string): Promise<ProblemNote> => {
    const response = await apiClient.post('/quality/notes/', { problem: problemId, step, text });
    return response.data;
  },

  updateNote: async (id: number, text: string): Promise<ProblemNote> => {
    const response = await apiClient.put(`/quality/notes/${id}/`, { text });
    return response.data;
  },

  deleteNote: async (id: number): Promise<void> => {
    await apiClient.delete(`/quality/notes/${id}/`);
  },
};