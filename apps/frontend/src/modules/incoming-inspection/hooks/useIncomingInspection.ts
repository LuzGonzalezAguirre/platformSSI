import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as svc from "../services/incomingInspectionService";
import type { IncomingInspectionFilters } from "../types";

export const useIncomingInspectionKPIs = (filters: IncomingInspectionFilters) =>
  useQuery({
    queryKey: ["incoming-inspection-kpis", filters],
    queryFn: () => svc.fetchKPIs(filters),
    enabled: false,
  });

export const useIncomingInspectionDetail = (
  filters: IncomingInspectionFilters, page: number, pageSize: number, ordering: string,
) =>
  useQuery({
    queryKey: ["incoming-inspection-detail", filters, page, pageSize, ordering],
    queryFn: () => svc.fetchDetail(filters, page, pageSize, ordering),
    enabled: false,
  });

export const useRejectedLots = (
  filters: IncomingInspectionFilters, page: number, pageSize: number,
) =>
  useQuery({
    queryKey: ["incoming-inspection-rejected-lots", filters, page, pageSize],
    queryFn: () => svc.fetchRejectedLots(filters, page, pageSize),
    enabled: false,
  });

export const useRejectionComments = (serialNo: string | null) =>
  useQuery({
    queryKey: ["incoming-inspection-rejection-comments", serialNo],
    queryFn: () => svc.fetchRejectionComments(serialNo as string),
    enabled: !!serialNo,
  });

export const useCreateRejectionComment = (serialNo: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment: string) => svc.postRejectionComment(serialNo as string, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incoming-inspection-rejection-comments", serialNo] });
    },
  });
};

// Resuelve nombres de "Changed By" para un set de Plexus_User_No. Cacheado
// 24h server-side (ver incoming_inspection_user_lookup_service.py); aquí
// también se cachea en react-query para no re-pedir en cada render.
export const useUserNames = (userNos: number[]) => {
  const key = [...new Set(userNos)].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["incoming-inspection-user-names", key],
    queryFn: () => svc.fetchUserNames(key),
    enabled: key.length > 0,
    staleTime: 1000 * 60 * 60, // 1h
  });
};

export const useSLAConfig = () =>
  useQuery({ queryKey: ["incoming-inspection-sla-config"], queryFn: svc.fetchSLAConfig });

export const useUpdateSLAConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.updateSLAConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incoming-inspection-sla-config"] });
      qc.invalidateQueries({ queryKey: ["incoming-inspection-kpis"] });
    },
  });
};