import apiClient from "./api.client";

export interface UserRole {
  id: number;
  name: string;
  slug: string;
  is_system: boolean;
}

export interface User {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: string | null;
  role_display: string;
  roles: UserRole[];
  plant: string;
  preferred_language: string;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface RoleChoice {
  value: string;
  label: string;
  is_system: boolean;
  description: string;
}

export interface CreateUserPayload {
  employee_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  plant: string;
  preferred_language: string;
  password: string;
  roles: string[];
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  plant?: string;
  preferred_language?: string;
  is_active?: boolean;
  roles?: string[];
}

export const UsersService = {
  list: async (params?: {
    role?: string;
    plant?: string;
    is_active?: boolean;
    search?: string;
  }) => {
    const response = await apiClient.get("/auth/users/", { params });
    return response.data as User[];
  },

  get: async (id: number) => {
    const response = await apiClient.get(`/auth/users/${id}/`);
    return response.data as User;
  },

  create: async (payload: CreateUserPayload) => {
    const response = await apiClient.post("/auth/users/", payload);
    return response.data as User;
  },

  update: async (id: number, payload: UpdateUserPayload) => {
    const response = await apiClient.patch(`/auth/users/${id}/`, payload);
    return response.data as User;
  },

  toggleActive: async (id: number) => {
    const response = await apiClient.post(`/auth/users/${id}/toggle-active/`);
    return response.data as User;
  },

  resetPassword: async (id: number, new_password: string, confirm_password: string) => {
    const response = await apiClient.post(`/auth/users/${id}/reset-password/`, {
      new_password,
      confirm_password,
    });
    return response.data;
  },

  roles: async () => {
    const response = await apiClient.get("/auth/roles/");
    return response.data as RoleChoice[];
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await apiClient.post("/auth/me/avatar/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};