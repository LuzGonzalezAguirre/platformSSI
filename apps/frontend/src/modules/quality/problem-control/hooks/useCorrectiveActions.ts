// apps/frontend/src/modules/quality/problem-control/hooks/useCorrectiveActions.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';
import type { CorrectiveAction } from '../types/problem.types';

export const useCorrectiveActions = (problemId?: number) => {
  return useQuery({
    queryKey: ['correctiveActions', problemId],
    queryFn: () => problemApi.getCorrectiveActions(problemId!),
    enabled: !!problemId,
    staleTime: 10000,
  });
};

export const useCorrectiveActionCreate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: problemApi.createCorrectiveAction,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['correctiveActions', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const useCorrectiveActionUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CorrectiveAction> }) =>
      problemApi.updateCorrectiveAction(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['correctiveActions', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const useCorrectiveActionDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; problemId: number }) =>
      problemApi.deleteCorrectiveAction(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['correctiveActions', variables.problemId] });
      queryClient.invalidateQueries({ queryKey: ['problem', variables.problemId] });
    },
  });
};
