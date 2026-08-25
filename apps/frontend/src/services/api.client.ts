import axios from "axios";

const VITE_API_BASE_URL = "http://localhost:8000/api/v1";

/**
 * DRF espera arrays en query params como keys repetidas
 * (?bu=VOLVO&bu=CUMMINS), no como axios los serializa por defecto
 * (?bu[]=VOLVO&bu[]=CUMMINS). Sin esto, cualquier filtro multi-valor
 * (bu, workcenter, shift) llega vacío al backend sin ningún error visible.
 */
function serializeParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, String(v)));
    } else {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

const apiClient = axios.create({
  baseURL: VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  paramsSerializer: serializeParams,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("mes_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const lang = localStorage.getItem("mes_language") || "es";
  config.headers["Accept-Language"] = lang;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mes_access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;