import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./modules/auth/LoginPage";
import AppShell from "./components/layout/AppShell";
import UsersPage from "./modules/admin/UsersPage";
import ProfilePage from "./modules/profile/ProfilePage";
import RolesPage from "./modules/admin/RolesPage";
import ClearToBuildPage from "./modules/warehouse/ClearToBuildPage";
import DemandPage       from "./modules/warehouse/DemandPage";
import TargetsPage from "./modules/production/targets/TargetsPage";
import SafetyPage from "./modules/production/safety/SafetyPage";
import AssistancePage from "./modules/production/assistance/AssistancePage";
import OpsReportPage from "./modules/production/ops-report/OpsReportPage";
import OverviewPage from "./modules/maintenance/overview/OverviewPage";
 import WorkRequestsPage from "./modules/maintenance/work-requests/WorkRequestsPage";




const now = new Date();
const hour = now.getHours();

const greeting =
  hour < 12 ? "Buenos días" :
  hour < 19 ? "Buenas tardes" :
  "Buenas noches";

function Dashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div style={styles.container}>
      {/* Logo de fondo */}
      <img
        src="/logoSSIclaro.png"
        style={styles.logo} 
        alt="logo"
      />

      {/* Contenido */}
      <div style={styles.content}>
        

        <h1 style={styles.title}>
  {greeting}{user?.full_name ? `, ${user.full_name}` : ""}
</h1>

<p style={styles.subtitle}>
  {now.toLocaleString()}
</p>
        <p style={styles.subtitle}>
          {user?.role_display || "Usuario"} ·{" "}
          {user?.plant || "Sin planta asignada"}
        </p>

        
      </div>
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
        <Route path="/production/ops-daily-report" element={<OpsReportPage />} />
        <Route path="/production/targets" element={<TargetsPage />} />
        <Route path="/production/safety" element={<SafetyPage />} />
        <Route path="/production/assistance" element={<AssistancePage />} />
        <Route path="/maintenance/orders" element={<div>Órdenes de Mantenimiento</div>} />
        <Route path="/settings/users" element={<UsersPage />} />        
        <Route path="/settings/roles" element={<RolesPage />} />
        <Route path="/settings/plant" element={<div>Planta</div>} />
        <Route path="/profile" element={<ProfilePage />} />        
        <Route path="/settings" element={<div>Configuración</div>} />
        <Route path="/warehouse/ctb"    element={<ClearToBuildPage />} />
        <Route path="/warehouse/demand" element={<DemandPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/maintenance/overview"    element={<OverviewPage />} />
        <Route path="/maintenance/actions"     element={<div>Actions — próximamente</div>} /> 
        <Route path="/maintenance/workcenter"  element={<div>Workcenter Detail — próximamente</div>} />
        <Route path="/maintenance/work-requests" element={<WorkRequestsPage />} />

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
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: "relative",
    padding: "2rem",
    borderRadius: "16px",
    overflow: "visible",
    background: "var(--color-bg-primary)",
  },

  logo: {
    position: "absolute",
    left: "50%",
    top: "50%", 
    transform: "translate(-50%, 190px)", 
    width: "60%",
    opacity: 0.10,
    pointerEvents: "none",
  },

  content: {
    position: "relative",
    zIndex: 1,
  },

  title: {
    color: "var(--color-text-primary)",
    fontSize: "1.8rem",
    fontWeight: 600,
    marginBottom: "0.3rem",
  },

  subtitle: {
    color: "var(--color-text-secondary)",
    fontSize: "1rem",
    marginBottom: "0.5rem",
  },

  meta: {
    color: "var(--color-text-secondary)",
    fontSize: "0.85rem",
    opacity: 0.7,
  },
};