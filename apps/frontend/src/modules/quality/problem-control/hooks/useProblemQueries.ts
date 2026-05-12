/**
 * React Query hooks for Problem Control
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../services/problemApi';
import type {
  ProblemFilters,
  ProblemCreateData,
  StageUpdateData,
  OverrideRequestData,
  SLASettings, 
} from '../types/problem.types';

// ========== QUERY KEYS ==========
export const problemKeys = {
  all: ['problems'] as const,
  lists: () => [...problemKeys.all, 'list'] as const,
  list: (filters?: ProblemFilters) => [...problemKeys.lists(), filters] as const,
  details: () => [...problemKeys.all, 'detail'] as const,
  detail: (id: string) => [...problemKeys.details(), id] as const,
  auditLog: (id: string) => [...problemKeys.detail(id), 'audit'] as const,
};

export const stageKeys = {
  all: ['stages'] as const,
  detail: (id: string) => [...stageKeys.all, id] as const,
};

export const slaKeys = {
  settings: ['sla', 'settings'] as const,
};

// ========== PROBLEM QUERIES ==========

export function useProblemList(filters?: ProblemFilters) {
  return useQuery({
    queryKey: problemKeys.list(filters),
    queryFn: () => problemApi.list(filters),
    staleTime: 30_000, // 30 seconds
  });
}

export function useProblemDetail(problemId: string) {
  return useQuery({
    queryKey: problemKeys.detail(problemId),
    queryFn: () => problemApi.detail(problemId),
    enabled: !!problemId,
  });
}

export function useProblemAuditLog(problemId: string) {
  return useQuery({
    queryKey: problemKeys.auditLog(problemId),
    queryFn: () => problemApi.getAuditLog(problemId),
    enabled: !!problemId,
  });
}

// ========== PROBLEM MUTATIONS ==========

export function useCreateProblem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ProblemCreateData) => problemApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

export function useUpdateProblem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProblemCreateData> }) =>
      problemApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: problemKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

export function useDeleteProblem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (problemId: string) => problemApi.delete(problemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

export function useSubmitProblem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (problemId: string) => problemApi.submit(problemId),
    onSuccess: (_, problemId) => {
      queryClient.invalidateQueries({ queryKey: problemKeys.detail(problemId) });
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

export function useApproveProblem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (problemId: string) => problemApi.approve(problemId),
    onSuccess: (_, problemId) => {
      queryClient.invalidateQueries({ queryKey: problemKeys.detail(problemId) });
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

export function useRejectProblem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ problemId, reason }: { problemId: string; reason: string }) =>
      problemApi.reject(problemId, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: problemKeys.detail(variables.problemId) });
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

export function useCloseProblem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (problemId: string) => problemApi.close(problemId),
    onSuccess: (_, problemId) => {
      queryClient.invalidateQueries({ queryKey: problemKeys.detail(problemId) });
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

// ========== STAGE MUTATIONS ==========

export function useUpdateStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stageId, data }: { stageId: string; data: StageUpdateData }) =>
      problemApi.updateStage(stageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemKeys.details() });
    },
  });
}

export function useCompleteStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (stageId: string) => problemApi.completeStage(stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemKeys.details() });
      queryClient.invalidateQueries({ queryKey: problemKeys.lists() });
    },
  });
}

export function useRequestOverride() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ stageId, data }: { stageId: string; data: OverrideRequestData }) =>
      problemApi.requestOverride(stageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemKeys.details() });
    },
  });
}

export function useApproveOverride() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (stageId: string) => problemApi.approveOverride(stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemKeys.details() });
    },
  });
}

// ========== SLA SETTINGS ==========

export function useSLASettings() {
  return useQuery({
    queryKey: slaKeys.settings,
    queryFn: () => problemApi.getSLASettings(),
  });
}

export function useUpdateSLASettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<SLASettings>) =>
      problemApi.updateSLASettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: slaKeys.settings });
    },
  });
}