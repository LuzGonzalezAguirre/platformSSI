// apps/frontend/src/features/quality/problem-control/hooks/useCatalogs.ts

import { useQuery } from '@tanstack/react-query';

import { problemApi } from '../api/problemApi';

export const useSeverityLevels = () => {
  return useQuery({
    queryKey: ['severity-levels'],
    queryFn: () => problemApi.getSeverityLevels(),
    staleTime: Infinity,
  });
};

export const useProblemCategories = () => {
  return useQuery({
    queryKey: ['problem-categories'],
    queryFn: () => problemApi.getProblemCategories(),
    staleTime: 3600000,
  });
};

export const useProblemTypes = () => {
  return useQuery({
    queryKey: ['problem-types'],
    queryFn: () => problemApi.getProblemTypes(),
    staleTime: 3600000,
  });
};

export const useDefectTypes = () => {
  return useQuery({
    queryKey: ['defect-types'],
    queryFn: () => problemApi.getDefectTypes(),
    staleTime: 3600000,
  });
};

export const useQualityUsers = () => {
  return useQuery({
    queryKey: ['quality-users'],
    queryFn: () => problemApi.getQualityUsers(),
    staleTime: 60000,
  });
};

export const useQualityManagers = () => {
  return useQuery({
    queryKey: ['quality-managers'],
    queryFn: () => problemApi.getQualityManagers(),
    staleTime: 300000,
  });
};