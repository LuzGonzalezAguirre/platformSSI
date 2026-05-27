import axios from "axios";

const BASE = "/api/v1/ssi/chairs";

export interface ChairFilters {
  start_date: string;
  end_date: string;
  turno?: string;
  department?: string;
}

export interface KpiData {
  today_breaks: number;
  total_breaks: number;
  avg_duration_min: number;
  active_now: number;
  auto_pct: number;
  manual_pct: number;
  compliance_pct: number;
  released_by_breakdown: { released_by: string; total: number; percentage: number }[];
}

export interface BreakRecord {
  barcode_id: string;
  employee_name: string;
  turno: string;
  department: string;
  chair_number: number;
  check_in: string;
  check_out: string;
  duration_min: number;
  released_by: string;
  break_date: string;
}

export interface BreaksPaginatedResponse {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  results: BreakRecord[];
}

export interface DailyChartPoint {
  break_date: string;
  total_breaks: number;
  avg_duration: number;
}

export interface TurnoDistPoint {
  turno: string;
  total: number;
}

export const chairApi = {
  getKpis: (filters: ChairFilters): Promise<KpiData> =>
    axios.get(`${BASE}/kpis/`, { params: filters }).then((r) => r.data),

  getBreaks: (
    filters: ChairFilters & {
      search?: string;
      page?: number;
      page_size?: number;
      order_by?: string;
      order_dir?: string;
    }
  ): Promise<BreaksPaginatedResponse> =>
    axios.get(`${BASE}/breaks/`, { params: filters }).then((r) => r.data),

  getDailyChart: (filters: ChairFilters): Promise<DailyChartPoint[]> =>
    axios.get(`${BASE}/charts/daily/`, { params: filters }).then((r) => r.data),

  getTurnoChart: (filters: ChairFilters): Promise<TurnoDistPoint[]> =>
    axios.get(`${BASE}/charts/turno/`, { params: filters }).then((r) => r.data),

  getPdfUrl: (filters: ChairFilters): string => {
    const token = localStorage.getItem("access_token") || "";
    const qs = new URLSearchParams({ ...filters, token } as Record<string, string>).toString();
    return `${BASE}/pdf/?${qs}`;
  },

  downloadPdf: (filters: ChairFilters): Promise<void> =>
    axios
      .get(`${BASE}/pdf/`, { params: filters, responseType: "blob" })
      .then((r) => {
        const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `reporte_leysilla_${filters.start_date}_${filters.end_date}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }),
};
