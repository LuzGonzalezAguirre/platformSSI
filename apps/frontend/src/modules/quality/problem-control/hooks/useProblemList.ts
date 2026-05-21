// apps/frontend/src/features/quality/problem-control/hooks/useProblemList.ts
import { useQuery } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';
import type { ProblemFilters } from '../types/problem.types';

export const useProblemList = (filters?: ProblemFilters) => {
  return useQuery({
    queryKey: ['problems', filters],
    queryFn: () => problemApi.getAll(filters),
    staleTime: 30000, // 30 segundos
  });
};