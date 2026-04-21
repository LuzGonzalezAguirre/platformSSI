import { create } from "zustand";

export type ModuleKey = "production" | "quality" | "maintenance" | "warehouse" | "administration";
export type ActionKey = "view" | "create" | "edit" | "delete";
export type UserPermissions = Record<ModuleKey, ActionKey[]>;

export interface UserRole {
  id: number;
  name: string;
  slug: string;
  is_system?: boolean;
}

export interface User {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  job_title: string;
  role_display: string;
  roles: UserRole[];
  plant: string;
  preferred_language: string;
  preferred_theme: string;
  timezone: string;
  last_login_at: string | null;
  requires_email: boolean;
  avatar_url: string | null;
  permissions: UserPermissions;
}

interface AuthState {
  user: User | null;
  access: string | null;
  refresh: string | null;
  isAuthenticated: boolean;
  setAuth: (access: string, refresh: string, user: User) => void;
  clearAuth: () => void;
  updateUser: (user: User) => void;
  hasPermission: (module: ModuleKey, action: ActionKey) => boolean;
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem("mes_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadUser(),
  access: localStorage.getItem("mes_access_token"),
  refresh: localStorage.getItem("mes_refresh_token"),
  isAuthenticated: !!localStorage.getItem("mes_access_token") && !!loadUser(),

  setAuth: (access, refresh, user) => {
  localStorage.setItem("mes_access_token", access);
  localStorage.setItem("mes_refresh_token", refresh);
  localStorage.setItem("mes_user", JSON.stringify(user));
  localStorage.setItem("mes_language", user.preferred_language);

  // Aplicar idioma activamente al iniciar sesión
  import("../i18n").then(({ default: i18n }) => {
    i18n.changeLanguage(user.preferred_language);
  });

  set({ access, refresh, user, isAuthenticated: true });
},

  clearAuth: () => {
    localStorage.removeItem("mes_access_token");
    localStorage.removeItem("mes_refresh_token");
    localStorage.removeItem("mes_user");
    set({ access: null, refresh: null, user: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    localStorage.setItem("mes_user", JSON.stringify(user));
    set({ user });
  },

  hasPermission: (module, action) => {
    const { user } = get();
    if (!user) return false;
    const actions = user.permissions?.[module];
    return Array.isArray(actions) && actions.includes(action);
  },
}));