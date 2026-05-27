import apiClient from "../../services/api.client";

export interface UserActivity {
  id: number;
  employee_id: string;
  full_name: string;
  plant: string;
  is_active: boolean;
  last_login_at: string | null;
  last_action_at: string | null;
  total_actions: number;
}

export interface AuditLog {
  id: number;
  user: number;
  user_name: string;
  user_employee_id: string;
  action: "LOGIN" | "LOGOUT" | "CREATE" | "UPDATE" | "DELETE";
  module: string;
  resource: string;
  resource_id: string;
  description: string;
  ip_address: string | null;
  timestamp: string;
}

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  module?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
}

export interface PaginatedAuditLogs {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditLog[];
}

export const auditApi = {
  getUserActivity: async (): Promise<UserActivity[]> => {
    const res = await apiClient.get("/audit/users/");
    return res.data;
  },

  getAuditLogs: async (filters: AuditLogFilters = {}): Promise<PaginatedAuditLogs> => {
    const params: Record<string, string> = {};
    if (filters.user_id) params.user_id = filters.user_id;
    if (filters.action) params.action = filters.action;
    if (filters.module) params.module = filters.module;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.search) params.search = filters.search;
    if (filters.page) params.page = String(filters.page);
    const res = await apiClient.get("/audit/logs/", { params });
    return res.data;
  },
};
