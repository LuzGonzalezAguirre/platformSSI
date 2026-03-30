import apiClient from "./api.client";

export const AuthService = {
  login: async (employee_id: string, password: string) => {
    const response = await apiClient.post("/auth/login/", {
      employee_id,
      password,
    });
    return response.data;
  },

  logout: async (refresh: string) => {
    await apiClient.post("/auth/logout/", { refresh });
  },

  me: async () => {
    const response = await apiClient.get("/auth/me/");
    return response.data;
  },
};