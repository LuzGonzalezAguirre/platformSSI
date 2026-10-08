import apiClient from "../../../../services/api.client";

// El backend valida sesión y permisos; las credenciales de CCS no llegan al navegador.
// El servicio qwall-proxy debe exponer /designer/* antes de habilitar la escritura.
const client = {
  get: (path: string, config?: { params?: Record<string, unknown> }) =>
    apiClient.get("/quality/qwall/designer" + path, config),
  post: (path: string, data?: unknown) =>
    apiClient.post("/quality/qwall/designer" + path, data),
  patch: (path: string, data?: unknown) =>
    apiClient.patch("/quality/qwall/designer" + path, data),
  delete: (path: string) =>
    apiClient.delete("/quality/qwall/designer" + path),
};
export default client;
