import apiClient from "../../../services/api.client";
import {
  PlantEmployee, AttendanceRecord,
  PlantEmployeeCreatePayload, AttendanceBulkPayload, DailyProductivity,
} from "./types";

const BASE = "/production";

export const AssistanceService = {
  // ── Employees (PostgreSQL: production_plant_employee) ───────────────────

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

  reactivateEmployee: (id: number): Promise<PlantEmployee> =>
    apiClient.post(`${BASE}/employees/${id}/reactivate/`).then((r: any) => r.data),

  // ── Attendance (PostgreSQL: production_attendance_record) ───────────────

  getAttendance: (date: string, turno?: "A" | "B"): Promise<AttendanceRecord[]> =>
    apiClient
      .get(`${BASE}/attendance/`, { params: { date, ...(turno ? { turno } : {}) } })
      .then((r: any) => Array.isArray(r.data) ? r.data : []),

  saveAttendance: (payload: AttendanceBulkPayload): Promise<{ saved: number }> =>
    apiClient.post(`${BASE}/attendance/`, payload).then((r: any) => r.data),

  // ── Productivity / Earned Hours ──────────────────────────────────────────

  getDailyProductivity: (date: string, turno?: "A" | "B"): Promise<DailyProductivity> =>
    apiClient
      .get(`${BASE}/productivity/daily/`, { params: { date, ...(turno ? { turno } : {}) } })
      .then((r: any) => r.data),

  getEarnedHours: (date: string): Promise<{ date: string; earned_hours: string; notes: string; recorded_at: string } | null> =>
    apiClient.get(`/production/earned-hours/`, { params: { date } })
      .then((r: any) => Object.keys(r.data).length === 0 ? null : r.data)
      .catch(() => null),

  saveEarnedHours: (date: string, earned_hours: number, notes: string): Promise<any> =>
    apiClient.post(`/production/earned-hours/`, { date, earned_hours, notes }).then((r: any) => r.data),

  deleteEarnedHours: (date: string): Promise<void> =>
    apiClient.delete(`/production/earned-hours/`, { params: { date } }).then(() => undefined),

  // ── Chair Control (Ley Silla) ────────────────────────────────────────────

  getChairKpis: (filters: { start_date: string; end_date: string; turno?: string }): Promise<any> =>
    apiClient.post(`${BASE}/chairs/kpis/`, filters).then((r: any) => r.data),

  getChairBreaks: (params: { start_date: string; end_date: string; turno?: string; page?: number; page_size?: number; search?: string }): Promise<any> =>
    apiClient.post(`${BASE}/chairs/breaks/`, params).then((r: any) => r.data),

  getChairDailyChart: (filters: { start_date: string; end_date: string; turno?: string }): Promise<any> =>
    apiClient.post(`${BASE}/chairs/daily-chart/`, filters).then((r: any) => r.data),

  getChairTurnoChart: (filters: { start_date: string; end_date: string }): Promise<any> =>
    apiClient.post(`${BASE}/chairs/turno-chart/`, filters).then((r: any) => r.data),
};