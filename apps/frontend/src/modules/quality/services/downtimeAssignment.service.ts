import apiClient from "../../../services/api.client";

const DOWNTIME_BASE = "/quality/downtime";
// role_id=4 = Quality Inspector en ssi_Roles (CCS) — confirmado.
const INSPECTOR_ROLE_ID = 4;

export type AssignmentSource = "workcenter" | "subgroup" | "group" | null;

export interface DowntimeResolvedValue {
  inspector_user_id: number | null;
  inspector_name: string | null;
  source: AssignmentSource;
  inherited_from: string | null;
}

export interface DowntimeWorkcenterNode extends DowntimeResolvedValue {
  workcenter_id: number;
  workcenter_name: string;
}

export interface DowntimeScopeNode extends DowntimeResolvedValue {
  group_key: string;
  subgroup_key: string;
  label: string;
  workcenters: DowntimeWorkcenterNode[];
}

export interface DowntimeGroupNode {
  group_key: string;
  label: string;
  workcenter_count: number;
  subgroups: DowntimeScopeNode[];
}

export interface DowntimeAssignmentTree {
  date: string;
  inheritance_lookback_days: number;
  groups: DowntimeGroupNode[];
}

export interface DowntimeGroupWrite {
  group_key: string;
  subgroup_key: string;
  inspector_user_id: number | null;
  inspector_name: string | null;
}

export interface DowntimeOverrideWrite {
  workcenter_id: number;
  inspector_user_id: number | null;
  inspector_name: string | null;
}

export interface QWallInspector {
  user_id: number;
  name: string;
  barcode_id: string;
  role_id: number;
  role_name: string;
  is_active: boolean;
  created_at: string;
}

export const scopeId = (groupKey: string, subgroupKey: string): string =>
  `${groupKey}::${subgroupKey}`;

export const DowntimeAssignmentService = {
  getTree: async (date: string): Promise<DowntimeAssignmentTree> => {
    const { data } = await apiClient.get(`${DOWNTIME_BASE}/assignments/`, {
      params: { date },
    });
    return data;
  },

  saveAssignments: async (
    date: string,
    groups: DowntimeGroupWrite[],
    overrides: DowntimeOverrideWrite[],
  ): Promise<{ date: string; groups_saved: number; overrides_saved: number }> => {
    const { data } = await apiClient.put(`${DOWNTIME_BASE}/assignments/`, {
      date,
      groups,
      overrides,
    });
    return data;
  },

  getInspectors: async (): Promise<QWallInspector[]> => {
    const { data } = await apiClient.get("/quality/qwall/settings/users/");
    const all: QWallInspector[] = data.data ?? [];
    return all.filter((u) => u.role_id === INSPECTOR_ROLE_ID && u.is_active);
  },
};