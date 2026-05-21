// apps/frontend/src/features/quality/problem-control/hooks/useCatalogs.ts
import { useQuery } from '@tanstack/react-query';
import { problemApi } from '../api/problemApi';

export const useSeverityLevels = () => {
  return useQuery({
    queryKey: ['severity-levels'],
    queryFn: () => problemApi.getSeverityLevels(),
    staleTime: Infinity, // Cache indefinido (raramente cambia)
  });
};

export const useDefectTypes = () => {
  return useQuery({
    queryKey: ['defect-types'],
    queryFn: () => problemApi.getDefectTypes(),
    staleTime: 3600000, // 1 hora
  });
};

export const useQualityUsers = () => {
  return useQuery({
    queryKey: ['quality-users'],
    queryFn: () => problemApi.getQualityUsers(),
    staleTime: 60000, // 5 minutos
  });
};

export const useQualityManagers = () => {
  return useQuery({
    queryKey: ['quality-managers'],
    queryFn: () => problemApi.getQualityManagers(),
    staleTime: 300000, // 5 minutos
  });
};