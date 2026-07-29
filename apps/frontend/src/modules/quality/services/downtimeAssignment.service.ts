import apiClient from "../../../services/api.client";

export interface DowntimeWorkcenterRow {
  id: number;
  name: string;
  workcenter_group: string;
  active: boolean;
}

export interface DowntimeAssignmentRow {
  workcenter_id: number;
  workcenter_name: string;
  date: string;
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

const DOWNTIME_BASE = "/quality/downtime";
// role_id=4 = Quality Inspector en ssi_Roles (CCS) — confirmado, son los
// únicos asignables a un workcenter según la tabla de roles real.
const INSPECTOR_ROLE_ID = 4;

export const DowntimeAssignmentService = {
  getWorkcenters: async (): Promise<DowntimeWorkcenterRow[]> => {
    const { data } = await apiClient.get(`${DOWNTIME_BASE}/workcenters/`);
    return data.results;
  },

  getAssignments: async (date: string): Promise<DowntimeAssignmentRow[]> => {
    const { data } = await apiClient.get(`${DOWNTIME_BASE}/assignments/`, { params: { date } });
    return data.results;
  },

  saveAssignments: async (
    date: string,
    assignments: { workcenter_id: number; inspector_user_id: number | null; inspector_name: string | null }[],
  ): Promise<{ date: string; saved: number }> => {
    const { data } = await apiClient.put(`${DOWNTIME_BASE}/assignments/`, { date, assignments });
    return data;
  },

  // Reusa el endpoint YA EXISTENTE de QWall Settings (mismo que alimenta
  // UsersTab.tsx) — no se creó nada nuevo en el backend para esto.
  // ⚠️ Verifica esta ruta con un curl antes de confiar en ella — se infirió
  // por el patrón consistente del resto de endpoints de qwall_settings_urls.py,
  // no se vio el archivo real de ese urls.py.
  getInspectors: async (): Promise<QWallInspector[]> => {
    const { data } = await apiClient.get("/quality/qwall/settings/users/");
    const all: QWallInspector[] = data.data ?? [];
    return all.filter((u) => u.role_id === INSPECTOR_ROLE_ID && u.is_active);
  },
};