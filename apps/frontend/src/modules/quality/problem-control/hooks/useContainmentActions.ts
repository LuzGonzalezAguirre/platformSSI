// apps/frontend/src/modules/quality/problem-control/hooks/useContainmentActions.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';
import type { ContainmentAction } from '../types/problem.types';

export const useContainmentActions = (problemId?: number) => {
  return useQuery({
    queryKey: ['containmentActions', problemId],
    queryFn: () => problemApi.getContainmentActions(problemId!),
    enabled: !!problemId,
    staleTime: 10000,
  });
};

export const useContainmentActionCreate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: problemApi.createContainmentAction,
    onSuccess: (data) => {
      // Invalidar la lista de acciones para ese problem
      queryClient.invalidateQueries({ 
        queryKey: ['containmentActions', data.problem] 
      });
      // También invalidar el problem detail
      queryClient.invalidateQueries({ 
        queryKey: ['problem', data.problem] 
      });
    },
  });
};

export const useContainmentActionUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ContainmentAction> }) =>
      problemApi.updateContainmentAction(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['containmentActions', data.problem] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['problem', data.problem] 
      });
    },
  });
};

export const useContainmentActionDelete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, problemId }: { id: number; problemId: number }) =>
      problemApi.deleteContainmentAction(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['containmentActions', variables.problemId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['problem', variables.problemId] 
      });
    },
  });
};