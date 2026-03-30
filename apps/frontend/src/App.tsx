import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./modules/auth/LoginPage";
import AppShell from "./components/layout/AppShell";
import UsersPage from "./modules/admin/UsersPage";
import ProfilePage from "./modules/profile/ProfilePage";
import RolesPage from "./modules/admin/RolesPage";
import BomExplorerPage  from "./modules/warehouse/BomExplorerPage";
import ClearToBuildPage from "./modules/warehouse/ClearToBuildPage";
import DemandPage       from "./modules/warehouse/DemandPage";

function Dashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <div>
      <h2 style={{ color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
        Bienvenido, {user?.full_name || user?.employee_id}
      </h2>
      <p style={{ color: "var(--color-text-secondary)" }}>
        Rol: {user?.role_display} — Planta: {user?.plant || "Sin asignar"}
      </p>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/production" element={<div>Producción</div>} />
        <Route path="/production/orders" element={<div>Órdenes de Producción</div>} />
        <Route path="/maintenance/orders" element={<div>Órdenes de Mantenimiento</div>} />
        <Route path="/settings/users" element={<UsersPage />} />        
        <Route path="/settings/roles" element={<RolesPage />} />
        <Route path="/settings/plant" element={<div>Planta</div>} />
        <Route path="/profile" element={<ProfilePage />} />        
        <Route path="/settings" element={<div>Configuración</div>} />
        <Route path="/warehouse/bom"    element={<BomExplorerPage />} />
        <Route path="/warehouse/ctb"    element={<ClearToBuildPage />} />
        <Route path="/warehouse/demand" element={<DemandPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <AppRoutes />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}