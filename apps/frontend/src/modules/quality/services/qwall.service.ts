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

export const QWallService = {
  getReport: async (startDate: string, endDate: string): Promise<QWallReport> => {
    const { data } = await apiClient.get("/quality/qwall/", {
      params: { start_date: startDate, end_date: endDate },
    });
    return data;
  },

  downloadExcel: async (startDate: string, endDate: string): Promise<void> => {
    const token   = localStorage.getItem("mes_access_token") ?? "";
    const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
    const url     = `${baseUrl}/quality/qwall/?start_date=${startDate}&end_date=${endDate}&export=xlsx`;

    console.log("Descargando Excel desde:", url);  // ← confirma la URL exacta

    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!response.ok) throw new Error(`Error ${response.status}`);

    const blob    = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = blobUrl;
    a.download    = `qwall_${startDate}_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(blobUrl);
},
};