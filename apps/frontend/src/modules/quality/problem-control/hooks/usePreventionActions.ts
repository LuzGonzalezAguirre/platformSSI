// apps/frontend/src/modules/quality/problem-control/hooks/usePreventionActions.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';
import type { PreventionAction } from '../types/problem.types';

export const usePreventionActions = (problemId?: number) => {
  return useQuery({
    queryKey: ['preventionActions', problemId],
    queryFn: () => problemApi.getPreventionActions(problemId!),
    enabled: !!problemId,
    staleTime: 10000,
  });
};

export const usePreventionActionCreate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: problemApi.createPreventionAction,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['preventionActions', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const usePreventionActionUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PreventionAction> }) =>
      problemApi.updatePreventionAction(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['preventionActions', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const usePreventionActionDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; problemId: number }) =>
      problemApi.deletePreventionAction(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['preventionActions', variables.problemId] });
      queryClient.invalidateQueries({ queryKey: ['problem', variables.problemId] });
    },
  });
};
