import axios from "axios";

const BASE = "/api/v1/ssi/attendance";

export interface AttendanceFilters {
  start_date: string;
  end_date: string;
  turno?: string;
  department?: string;
  employee_id?: number;
}

export interface AttendanceKpis {
  present_today: number;
  total_absences: number;
  total_delays: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  grand_total_hours: number;
}

export interface AttendanceRecord {
  attendance_id: number;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  turno: string;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_hours: number | null;
  status: string;
  notes: string | null;
  barcode_id: string;
  employee_name: string;
  department: string;
}

export interface PaginatedAttendance {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  results: AttendanceRecord[];
}

export interface Employee {
  id: number;
  barcode_id: string;
  name: string;
  department: string;
  turno: string;
}

export interface CheckInResponse {
  success: boolean;
  message?: string;
  employee?: Employee;
  turno?: string;
  attendance_date?: string;
  error?: string;
}

export const attendanceApi = {
  getKpis: (filters: AttendanceFilters): Promise<AttendanceKpis> =>
    axios.get(`${BASE}/kpis/`, { params: filters }).then((r) => r.data),

  getRecords: (
    filters: AttendanceFilters & { page?: number; page_size?: number }
  ): Promise<PaginatedAttendance> =>
    axios.get(`${BASE}/records/`, { params: filters }).then((r) => r.data),

  getEmployees: (department?: string): Promise<Employee[]> =>
    axios.get(`${BASE}/employees/`, { params: { department } }).then((r) => r.data),

  getDepartments: (): Promise<string[]> =>
    axios.get(`${BASE}/departments/`).then((r) => r.data),

  checkIn: (barcode_id: string): Promise<CheckInResponse> =>
    axios.post(`${BASE}/check-in/`, { barcode_id }).then((r) => r.data),

  checkOut: (barcode_id: string): Promise<CheckInResponse> =>
    axios.post(`${BASE}/check-out/`, { barcode_id }).then((r) => r.data),

  getTodayStatus: (barcode_id: string) =>
    axios.get(`${BASE}/today-status/`, { params: { barcode_id } }).then((r) => r.data),

  registerOvertime: (employee_id: number, overtime_date: string): Promise<{ success: boolean; message?: string }> =>
    axios.post(`${BASE}/overtime/`, { employee_id, overtime_date }).then((r) => r.data),

  downloadPdf: (filters: AttendanceFilters): Promise<void> =>
    axios.get(`${BASE}/pdf/`, { params: filters, responseType: "blob" }).then((r) => {
      const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `asistencia_${filters.start_date}_${filters.end_date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }),

  downloadExcel: (filters: AttendanceFilters): Promise<void> =>
    axios
      .get(`${BASE}/excel/`, { params: filters, responseType: "blob" })
      .then((r) => {
        const url = URL.createObjectURL(
          new Blob([r.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          })
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `asistencia_${filters.start_date}_${filters.end_date}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }),
};
