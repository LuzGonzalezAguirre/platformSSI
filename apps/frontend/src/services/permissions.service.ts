import apiClient from "./api.client";

export type ModuleKey = "production" | "quality" | "maintenance" | "warehouse" | "administration";
export type ActionKey = "view" | "create" | "edit" | "delete";

export interface Role {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_system: boolean;
  permissions: string[];
  user_count: number;
}

export interface Permission {
  module: ModuleKey;
  action: ActionKey;
}

export interface ModuleChoice {
  value: ModuleKey;
  label: string;
}

export interface ActionChoice {
  value: ActionKey;
  label: string;
}

export interface UserOverride {
  id: number;
  user: number;
  module: ModuleKey;
  action: ActionKey;
  override_type: "grant" | "revoke";
}

export interface UserPermissions {
  permissions: Record<ModuleKey, ActionKey[]>;
  overrides: UserOverride[];
}

export const PermissionsService = {
  getAllRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get("/permissions/roles/");
    return response.data;
},

  getRolePermissions: async (role: string): Promise<Permission[]> => {
    const response = await apiClient.get(`/permissions/roles/${role}/`);
    return response.data;
  },

  setRolePermissions: async (role: string, permissions: string[]): Promise<void> => {
  await apiClient.put(`/permissions/roles/${role}/`, { permissions });
},

  getUserPermissions: async (userId: number): Promise<UserPermissions> => {
    const response = await apiClient.get(`/permissions/users/${userId}/`);
    return response.data;
  },

  setUserOverride: async (
    userId: number,
    module: ModuleKey,
    action: ActionKey,
    override_type: "grant" | "revoke",
  ): Promise<void> => {
    await apiClient.post(`/permissions/users/${userId}/`, { module, action, override_type });
  },

  removeUserOverride: async (userId: number, module: ModuleKey, action: ActionKey): Promise<void> => {
    await apiClient.delete(`/permissions/users/${userId}/`, { params: { module, action } });
  },

  getMyPermissions: async (): Promise<Record<ModuleKey, ActionKey[]>> => {
    const response = await apiClient.get("/permissions/me/");
    return response.data;
  },

  getChoices: async (): Promise<{ modules: ModuleChoice[]; actions: ActionChoice[] }> => {
    const response = await apiClient.get("/permissions/choices/");
    return response.data;
  },
};