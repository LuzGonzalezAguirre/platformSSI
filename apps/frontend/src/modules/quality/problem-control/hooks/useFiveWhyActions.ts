// apps/frontend/src/modules/quality/problem-control/hooks/useFiveWhyActions.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';
import type { FiveWhyAnalysis, RootCause } from '../types/problem.types';

// ── Five Why Analyses ──────────────────────────────────────────────────────

export const useFiveWhyAnalyses = (problemId?: number) => {
  return useQuery({
    queryKey: ['fiveWhyAnalyses', problemId],
    queryFn: () => problemApi.getFiveWhyAnalyses(problemId!),
    enabled: !!problemId,
    staleTime: 10000,
  });
};

export const useFiveWhyAnalysisCreate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: problemApi.createFiveWhyAnalysis,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fiveWhyAnalyses', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const useFiveWhyAnalysisUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FiveWhyAnalysis> }) =>
      problemApi.updateFiveWhyAnalysis(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fiveWhyAnalyses', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const useFiveWhyAnalysisDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; problemId: number }) =>
      problemApi.deleteFiveWhyAnalysis(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fiveWhyAnalyses', variables.problemId] });
      queryClient.invalidateQueries({ queryKey: ['problem', variables.problemId] });
    },
  });
};

// ── Root Causes ────────────────────────────────────────────────────────────

export const useRootCauses = (fiveWhyId?: number) => {
  return useQuery({
    queryKey: ['rootCauses', fiveWhyId],
    queryFn: () => problemApi.getRootCauses(fiveWhyId!),
    enabled: !!fiveWhyId,
    staleTime: 10000,
  });
};

export const useRootCauseCreate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: problemApi.createRootCause,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rootCauses', data.five_why] });
      queryClient.invalidateQueries({ queryKey: ['fiveWhyAnalyses'] });
    },
  });
};

export const useRootCauseUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RootCause> }) =>
      problemApi.updateRootCause(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rootCauses', data.five_why] });
      queryClient.invalidateQueries({ queryKey: ['fiveWhyAnalyses'] });
    },
  });
};

export const useRootCauseDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; fiveWhyId: number }) =>
      problemApi.deleteRootCause(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rootCauses', variables.fiveWhyId] });
      queryClient.invalidateQueries({ queryKey: ['fiveWhyAnalyses'] });
    },
  });
};
