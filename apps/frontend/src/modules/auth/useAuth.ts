import { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { AuthService } from "../../services/auth.service";

export function useAuth() {
  const { setAuth, clearAuth, updateUser, user, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresca el usuario desde el backend al montar — garantiza permisos actualizados
  useEffect(() => {
    if (!isAuthenticated) return;
    AuthService.me().then((freshUser) => {
      updateUser(freshUser);
    }).catch(() => {
      // Token expirado o inválido — no forzar logout aquí, el interceptor lo maneja
    });
  }, []);

  const login = async (employee_id: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await AuthService.login(employee_id, password);
      setAuth(data.access, data.refresh, data.user);
      return true;
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.employee_id?.[0] ||
        "Error al iniciar sesión.";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const refresh = localStorage.getItem("mes_refresh_token") || "";
    try {
      await AuthService.logout(refresh);
    } finally {
      clearAuth();
    }
  };

  return { login, logout, user, isAuthenticated, loading, error };
}