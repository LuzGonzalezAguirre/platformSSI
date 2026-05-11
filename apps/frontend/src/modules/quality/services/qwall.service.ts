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
  fail_mode: string;
  count:     number;
}

export interface QWallRow {
  inspection_id:    number;
  serial_ssi:       string;
  serial_volvo:     string;
  work_order:       string;
  part_number:      string;
  inspector:        string;
  inspection_type:  string;
  result:           "PASS" | "FAIL";
  fail_modes:       string;
  inspection_date:  string;
  time_start:       string;
  time_end:         string;
  duration_seconds: number;
  week_number:      number;
  month_name:       string;
}

export interface QWallReport {
  summary:      QWallSummary;
  by_inspector: QWallInspectorRow[];
  by_part:      QWallPartRow[];
  fail_modes:   QWallFailMode[];
  rows:         QWallRow[];
}

// Agregar interface
export interface QWallPartNumber {
  pn_id:               number;
  ssiPN:               string;
  volvoProductNumber:  string;
  bu_name:             string;
}



export const QWallService = {
  getReport: async (startDate: string, endDate: string, includeTest = false): Promise<QWallReport> => {
  const { data } = await apiClient.get("/quality/qwall/", {
    params: {
      start_date:   startDate,
      end_date:     endDate,
      include_test: String(includeTest),
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