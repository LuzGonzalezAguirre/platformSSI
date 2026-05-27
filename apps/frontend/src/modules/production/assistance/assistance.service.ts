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

  getEarnedHours: (date: string): Promise<{ date: string; earned_hours: string; notes: string; recorded_at: string } | null> =>
    apiClient.get(`/production/earned-hours/`, { params: { date } })
      .then((r: any) => Object.keys(r.data).length === 0 ? null : r.data)
      .catch(() => null),

  saveEarnedHours: (date: string, earned_hours: number, notes: string): Promise<any> =>
    apiClient.post(`/production/earned-hours/`, { date, earned_hours, notes }).then((r: any) => r.data),

  deleteEarnedHours: (date: string): Promise<void> =>
    apiClient.delete(`/production/earned-hours/`, { params: { date } }).then(() => undefined),

  // ── CCS Attendance Daily (ssi_production_employee + ssi_Attendance) ────────

  getCcsAttendance: (date: string, turno?: string): Promise<any[]> =>
    apiClient.get(`${BASE}/ccs/attendance/daily/`, { params: { date, ...(turno ? { turno } : {}) } })
      .then((r: any) => Array.isArray(r.data) ? r.data : []),

  saveCcsAttendance: (records: { employee_id: number; date: string; turno: string; status: string; shift: string; hours: number }[]): Promise<{ saved: number }> =>
    apiClient.post(`${BASE}/ccs/attendance/daily/`, { records }).then((r: any) => r.data),

  // ── CCS Employees (ssi_production_employee) ─────────────────────────────

  getCcsEmployees: (opts?: { department?: string; include_inactive?: boolean }): Promise<any[]> =>
    apiClient.get(`${BASE}/ccs/employees/`, { params: opts ?? {} })
      .then((r: any) => r.data?.data ?? []),

  createCcsEmployee: (payload: { name: string; department: string; turno: "A" | "B"; barcode_id?: string }): Promise<any> =>
    apiClient.post(`${BASE}/ccs/employees/`, payload).then((r: any) => r.data),

  updateCcsEmployee: (id: number, payload: { name?: string; department?: string; turno?: "A" | "B"; barcode_id?: string }): Promise<any> =>
    apiClient.patch(`${BASE}/ccs/employees/${id}/`, payload).then((r: any) => r.data),

  deactivateCcsEmployee: (id: number): Promise<any> =>
    apiClient.delete(`${BASE}/ccs/employees/${id}/`).then((r: any) => r.data),

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