import { useState, useEffect, useCallback } from "react";
import { UsersService, User, RoleChoice } from "../../services/users.service";

interface Filters {
  search: string;
  role: string;
  is_active: string;
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    role: "",
    is_active: "",
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      if (filters.is_active !== "") params.is_active = filters.is_active === "true";
      const data = await UsersService.list(params);
      setUsers(data);
    } catch {
      setError("Error al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await UsersService.roles();
      setRoles(data);
    } catch {
      setError("Error al cargar roles.");
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const createUser = async (payload: any) => {
    const user = await UsersService.create(payload);
    setUsers((prev) => [...prev, user]);
    return user;
  };

  const updateUser = async (id: number, payload: any) => {
    const user = await UsersService.update(id, payload);
    setUsers((prev) => prev.map((u) => (u.id === id ? user : u)));
    return user;
  };

  const toggleActive = async (id: number) => {
    const user = await UsersService.toggleActive(id);
    setUsers((prev) => prev.map((u) => (u.id === id ? user : u)));
    return user;
  };

  const resetPassword = async (id: number, new_password: string, confirm_password: string) => {
    return UsersService.resetPassword(id, new_password, confirm_password);
  };

  return {
    users,
    roles,
    loading,
    error,
    filters,
    setFilters,
    createUser,
    updateUser,
    toggleActive,
    resetPassword,
    refetch: fetchUsers,
  };
}