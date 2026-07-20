import apiClient from "../../../services/api.client";

export interface QWallSummary {
  total:        number;
  pass:         number;
  fail:         number;
  pass_rate:    number;
  avg_duration: number;
  inspectors:   number;
  part_numbers: number;
}

export interface QWallInspectorRow {
  inspector:    string;
  total:        number;
  pass:         number;
  fail:         number;
  pass_rate:    number;
  avg_duration: number;
}

export interface QWallPartRow {
  part_number: string;
  total:       number;
  pass:        number;
  fail:        number;
  pass_rate:   number;
}

export interface QWallFailMode {
  code:           string;
  name:           string;
  count:          number;
  pct_of_total:   number;
  cumulative_pct: number;
}

export interface QWallRow {
  inspection_id:    number;
  serial_ssi:       string;
  serial_volvo:     string;
  work_order:       string;
  part_number:      string;
  bu_id:            number | null;
  inspector:        string;
  inspection_type:  string;
  result:           "PASS" | "FAIL";
  fail_modes:       string;
  fail_mode_codes:  string;
  inspection_date:  string;
  time_start:       string;
  time_end:         string;
  duration_seconds: number;
  week_number:      number;
  month_name:       string;
  flag_id:              number | null;
  flag_comment:         string | null;
  flag_fail_mode_name:  string | null;
}

export type QWallTrendGranularity = "daily" | "weekly" | "monthly";
export type QWallTrendStatus      = "on_target" | "below_target";

export interface QWallTrendPoint {
  period:      string;
  week?:       number;
  pass_rate:   number;
  fail_count:  number;
  total_count: number;
  target_pct:  number;
  status:      QWallTrendStatus;
}

export interface QWallTrendResponse {
  granularity: QWallTrendGranularity;
  target_pct:  number;
  points:      QWallTrendPoint[];
}

export interface QWallParetoResponse {
  granularity: QWallTrendGranularity;
  range_start: string;
  range_end:   string;
  items:       QWallFailMode[];
}

export interface QWallRunsPerPart {
  part_number: string;
  run_count:   number;
}

export interface QWallPartNumberSummary {
  part_number:      string;
  inspection_count: number;
  run_count:        number;
  pass_rate:        number;
}

export interface QWallReport {
  summary:              QWallSummary;
  by_inspector:         QWallInspectorRow[];
  by_part:               QWallPartRow[];
  fail_modes:            QWallFailMode[];
  flag_count:            number;
  changeover_count:      number;
  runs_per_part:         QWallRunsPerPart[];
  rows:                  QWallRow[];
}

export interface QWallBuSummaryItem {
  business_unit_id:   number;
  business_unit_name: string;
  inspection_count:   number;
  pass:               number;
  fail:               number;
  run_count:          number;
  pass_rate:          number;
}

export interface QWallBuSummaryResponse {
  items: QWallBuSummaryItem[];
}

export interface QWallPartNumberSummaryResponse {
  business_unit_id:      number;
  items:                 QWallPartNumberSummary[];
  lowest_pass_rate_part: QWallPartNumberSummary | null;
}

export interface QWallFailByPointItem {
  inspection_point_id:   number;
  inspection_point_name: string;
  fail_count:             number;
  pct_of_total_fails:     number;
}

export interface QWallFailByPointResponse {
  has_fails: boolean;
  items:     QWallFailByPointItem[];
}

// Agregar interface
export interface QWallPartNumber {
  pn_id:               number;
  ssiPN:               string;
  volvoProductNumber:  string;
  bu_id:               number;
  bu_name:             string;
}



export const QWallService = {
  getReport: async (startDate: string, endDate: string, includeTest = false, buId?: number): Promise<QWallReport> => {
  const { data } = await apiClient.get("/quality/qwall/", {
    params: {
      start_date:   startDate,
      end_date:     endDate,
      include_test: String(includeTest),
      ...(buId ? { bu_id: buId } : {}),
    },
  });
  return data;
},

getTrend: async (
  granularity: QWallTrendGranularity,
  startDate: string,
  endDate: string,
  includeTest = false,
  buId?: number,
): Promise<QWallTrendResponse> => {
  const { data } = await apiClient.get("/quality/qwall/trend/", {
    params: {
      granularity,
      start_date:   startDate,
      end_date:     endDate,
      include_test: String(includeTest),
      ...(buId ? { bu_id: buId } : {}),
    },
  });
  return data;
},


getPareto: async (
  granularity: QWallTrendGranularity,
  startDate: string,
  endDate: string,
  includeTest = false,
  buId?: number,
  limit = 10,
): Promise<QWallParetoResponse> => {
  const { data } = await apiClient.get("/quality/qwall/pareto/", {
    params: {
      granularity,
      start_date:   startDate,
      end_date:     endDate,
      include_test: String(includeTest),
      limit,
      ...(buId ? { bu_id: buId } : {}),
    },
  });
  return data;
},

getBuSummary: async (
  startDate: string,
  endDate: string,
  includeTest = false,
): Promise<QWallBuSummaryResponse> => {
  const { data } = await apiClient.get("/quality/qwall/bu-summary/", {
    params: {
      start_date:   startDate,
      end_date:     endDate,
      include_test: String(includeTest),
    },
  });
  return data;
},

getPartNumberSummary: async (
  startDate: string,
  endDate: string,
  businessUnitId: number,
  includeTest = false,
): Promise<QWallPartNumberSummaryResponse> => {
  const { data } = await apiClient.get("/quality/qwall/part-number-summary/", {
    params: {
      start_date:        startDate,
      end_date:          endDate,
      include_test:      String(includeTest),
      business_unit_id:  businessUnitId,
    },
  });
  return data;
},

getFailByPoint: async (
  startDate: string,
  endDate: string,
  includeTest = false,
  buId?: number,
): Promise<QWallFailByPointResponse> => {
  const { data } = await apiClient.get("/quality/qwall/fail-by-point/", {
    params: {
      start_date:   startDate,
      end_date:     endDate,
      include_test: String(includeTest),
      ...(buId ? { bu_id: buId } : {}),
    },
  });
  return data;
},

downloadExcel: async (startDate: string, endDate: string, includeTest = false): Promise<void> => {
  const token   = localStorage.getItem("mes_access_token") ?? "";
  const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
  const url     = `${baseUrl}/quality/qwall/?start_date=${startDate}&end_date=${endDate}&export=xlsx&include_test=${includeTest}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`Error ${response.status}`);

  const blob    = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = blobUrl;
  a.download    = `qwall_${startDate}_${endDate}${includeTest ? "_test" : ""}.xlsx`;
  a.click();
  URL.revokeObjectURL(blobUrl);
},
// Agregar al objeto QWallService:
getPartNumbers: async (): Promise<QWallPartNumber[]> => {
  const { data } = await apiClient.get("/quality/qwall/part-numbers/");
  return data;
},
};