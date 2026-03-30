import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
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