import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as svc from "../services/incomingInspectionService";
import type { IncomingInspectionFilters } from "../types";

// enabled: false en ambos — el dashboard es "load on demand" vía el botón
// "Cargar" (debugging temporal de por qué History sigue en cero); ver
// IncomingInspectionPage.tsx. No auto-fetch al montar ni al cambiar filtros.
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
