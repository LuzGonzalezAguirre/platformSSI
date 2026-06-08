import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as svc from "../services/qwallSettingsService";
import type { PartNumberScanRule } from "../types";

// ── Catalogs ──────────────────────────────────────────────────────────────────

export const useBusinessUnits = () =>
  useQuery({ queryKey: ["qwall-business-units"], queryFn: svc.fetchBusinessUnits, staleTime: 5 * 60_000 });

export const useQWallRoles = () =>
  useQuery({ queryKey: ["qwall-roles"], queryFn: svc.fetchQWallRoles, staleTime: 5 * 60_000 });

// ── Users ─────────────────────────────────────────────────────────────────────

export const useQWallUsers = () =>
  useQuery({ queryKey: ["qwall-settings-users"], queryFn: svc.fetchUsers });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-settings-users"] }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ user_id, body }: { user_id: number; body: Parameters<typeof svc.updateUser>[1] }) =>
      svc.updateUser(user_id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-settings-users"] }),
  });
};

export const useDeactivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.deactivateUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-settings-users"] }),
  });
};

// ── Part Numbers ──────────────────────────────────────────────────────────────

export const usePartNumbers = (bu_id?: number) =>
  useQuery({ queryKey: ["qwall-part-numbers", bu_id], queryFn: () => svc.fetchPartNumbers(bu_id) });

export const useCreatePartNumber = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createPartNumber,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-part-numbers"] }),
  });
};

export const useUpdatePartNumber = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pn_id, body }: { pn_id: number; body: Parameters<typeof svc.updatePartNumber>[1] }) =>
      svc.updatePartNumber(pn_id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-part-numbers"] }),
  });
};

export const useDeletePartNumber = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.deletePartNumber,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-part-numbers"] }),
  });
};

// ── Inspection Points ─────────────────────────────────────────────────────────

export const useInspectionPoints = (bu_id?: number) =>
  useQuery({ queryKey: ["qwall-inspection-points", bu_id], queryFn: () => svc.fetchInspectionPoints(bu_id) });

export const useCreateInspectionPoint = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createInspectionPoint,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-inspection-points"] }),
  });
};

export const useUpdateInspectionPoint = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ point_id, body }: { point_id: number; body: Parameters<typeof svc.updateInspectionPoint>[1] }) =>
      svc.updateInspectionPoint(point_id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-inspection-points"] }),
  });
};

export const useDeactivateInspectionPoint = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.deactivateInspectionPoint,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-inspection-points"] }),
  });
};

// ── Fail Modes ────────────────────────────────────────────────────────────────

export const useFailModes = (bu_id?: number, point_id?: number) =>
  useQuery({ queryKey: ["qwall-fail-modes", bu_id, point_id], queryFn: () => svc.fetchFailModes(bu_id, point_id) });

export const useCreateFailMode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createFailMode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-fail-modes"] }),
  });
};

export const useUpdateFailMode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fail_mode_id, body }: { fail_mode_id: number; body: Parameters<typeof svc.updateFailMode>[1] }) =>
      svc.updateFailMode(fail_mode_id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-fail-modes"] }),
  });
};

export const useDeactivateFailMode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.deactivateFailMode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-fail-modes"] }),
  });
};

export const useAssignFailModePoints = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fail_mode_id, point_ids }: { fail_mode_id: number; point_ids: number[] }) =>
      svc.assignFailModePoints(fail_mode_id, point_ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-fail-modes"] }),
  });
};

// ── System Config ─────────────────────────────────────────────────────────────

export const useSystemConfig = () =>
  useQuery({ queryKey: ["qwall-system-config"], queryFn: svc.fetchSystemConfig });

export const useUpdateSystemConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ config_key, value }: { config_key: string; value: string }) =>
      svc.updateSystemConfig(config_key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qwall-system-config"] }),
  });
};

// ── Scan Rules ────────────────────────────────────────────────────────────────

export const useScanRules = (bu_id?: number, is_active?: boolean) =>
  useQuery({
    queryKey: ["scan-rules", bu_id, is_active],
    queryFn:  () => svc.fetchScanRules(bu_id, is_active),
  });

export const useScanRule = (id: number) =>
  useQuery({
    queryKey: ["scan-rule", id],
    queryFn:  () => svc.fetchScanRule(id),
    enabled:  !!id,
  });

export const useCreateScanRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<PartNumberScanRule, 'id'>) => svc.createScanRule(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-rules"] }),
  });
};

export const useUpdateScanRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PartNumberScanRule> }) =>
      svc.updateScanRule(id, data),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["scan-rules"] });
      qc.invalidateQueries({ queryKey: ["scan-rule", vars.id] });
    },
  });
};

export const useToggleScanRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => svc.toggleScanRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-rules"] }),
  });
};

export const useDeleteScanRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => svc.deleteScanRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-rules"] }),
  });
};

export const usePartNumberLookup = (bu_id?: number) =>
  useQuery({
    queryKey: ["pn-lookup", bu_id],
    queryFn:  () => svc.fetchPartNumberLookup(bu_id),
    staleTime: 5 * 60_000,
  });
