// apps/frontend/src/features/quality/problem-control/hooks/useProblemDetail.ts
import { useQuery } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';

export const useProblemDetail = (id: number | undefined) => {
  return useQuery({
    queryKey: ['problem', id],
    queryFn: () => problemApi.getById(id!),
    enabled: !!id, // Solo ejecutar si id existe
    staleTime: 10000, // 10 segundos
  });
};