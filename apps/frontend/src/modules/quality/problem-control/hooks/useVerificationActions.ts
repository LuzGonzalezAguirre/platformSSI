// apps/frontend/src/modules/quality/problem-control/hooks/useVerificationActions.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';
import type { VerificationAction } from '../types/problem.types';

export const useVerificationActions = (problemId?: number) => {
  return useQuery({
    queryKey: ['verificationActions', problemId],
    queryFn: () => problemApi.getVerificationActions(problemId!),
    enabled: !!problemId,
    staleTime: 10000,
  });
};

export const useVerificationActionCreate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: problemApi.createVerificationAction,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['verificationActions', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const useVerificationActionUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VerificationAction> }) =>
      problemApi.updateVerificationAction(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['verificationActions', data.problem] });
      queryClient.invalidateQueries({ queryKey: ['problem', data.problem] });
    },
  });
};

export const useVerificationActionDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; problemId: number }) =>
      problemApi.deleteVerificationAction(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['verificationActions', variables.problemId] });
      queryClient.invalidateQueries({ queryKey: ['problem', variables.problemId] });
    },
  });
};
