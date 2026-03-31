import apiClient from "../../../services/api.client";
import {
  PlantEmployee, AttendanceRecord,
  PlantEmployeeCreatePayload, AttendanceBulkPayload,
} from "./types";

const BASE = "/production";

export const AssistanceService = {
  listEmployees: (turno?: "A" | "B", includeInactive = false): Promise<PlantEmployee[]> =>
    apiClient
      .get(`${BASE}/employees/`, {
        params: {
          ...(turno ? { turno } : {}),
          ...(includeInactive ? { include_inactive: true } : {}),
        },
      })
      .then((r: any) => r.data),

  createEmployee: (payload: PlantEmployeeCreatePayload): Promise<PlantEmployee> =>
    apiClient.post(`${BASE}/employees/`, payload).then((r: any) => r.data),

  updateEmployee: (
    id: number,
    payload: Partial<PlantEmployeeCreatePayload>,
  ): Promise<PlantEmployee> =>
    apiClient.patch(`${BASE}/employees/${id}/`, payload).then((r: any) => r.data),

  deactivateEmployee: (id: number): Promise<PlantEmployee> =>
    apiClient.delete(`${BASE}/employees/${id}/`).then((r: any) => r.data),

  getAttendance: (date: string, turno?: "A" | "B"): Promise<AttendanceRecord[]> =>
    apiClient
      .get(`${BASE}/attendance/`, { params: { date, ...(turno ? { turno } : {}) } })
      .then((r: any) => r.data),

  saveAttendance: (payload: AttendanceBulkPayload): Promise<{ saved: number }> =>
    apiClient.post(`${BASE}/attendance/`, payload).then((r: any) => r.data),
};