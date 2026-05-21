// apps/frontend/src/features/quality/problem-control/hooks/useProblemMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';
import type {
  ProblemCreateRequest,
  ProblemUpdateRequest,
  ApproveRequest,
  RejectRequest,
  OverrideRequest,
} from '../types/problem.types';

export const useProblemCreate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProblemCreateRequest) => problemApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useProblemUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProblemUpdateRequest }) =>
      problemApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['problem', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useProblemDelete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => problemApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useProblemSubmit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => problemApi.submit(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['problem', id] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useProblemApprove = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ApproveRequest }) =>
      problemApi.approve(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['problem', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useProblemReject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RejectRequest }) =>
      problemApi.reject(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['problem', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useProblemClose = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => problemApi.close(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['problem', id] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useProblemOverrideRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: OverrideRequest }) =>
      problemApi.requestOverride(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['problem', variables.id] });
    },
  });
};

export const useProblemOverrideApprove = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => problemApi.approveOverride(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['problem', id] });
    },
  });
};