// apps/frontend/src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore, ModuleKey, ActionKey } from "./store/authStore";
import LoginPage from "./modules/auth/LoginPage";
import AppShell from "./components/layout/AppShell";
import UsersPage from "./modules/admin/UsersPage";
import ProfilePage from "./modules/profile/ProfilePage";
import RolesPage from "./modules/admin/RolesPage";
import ClearToBuildPage from "./modules/warehouse/ClearToBuildPage";
import DemandPage from "./modules/warehouse/DemandPage";
import TargetsPage from "./modules/production/targets/TargetsPage";
import SafetyPage from "./modules/production/safety/SafetyPage";
import AssistancePage from "./modules/production/assistance/AssistancePage";
import LeysillaPage from "./modules/production/leysilla/LeysillaPage";
import OpsReportPage from "./modules/production/ops-report/OpsReportPage";
import OverviewPage from "./modules/maintenance/overview/OverviewPage";
import WorkRequestsPage from "./modules/maintenance/work-requests/WorkRequestsPage";
import QualityDashboard from "./modules/quality/QualityDashboard";
import QualityPanelPage from "./modules/quality/QualityPanelPage";
import OperationalPanelPage from "./modules/operational-panel/OperationalPanelPage";
import CorrectiveActionsPage from "./modules/maintenance/corrective-actions/CorrectiveActionsPage";
import QWallPage from "./modules/quality/qwall/QWallPage";
import QWallDashboardPage from "./modules/quality/qwall/QWallDashboardPage";
import RejectionReportPage from "./modules/quality/RejectionReportPage";
import CogpDashboardPage from "./modules/quality/cogp/CogpDashboardPage";
import CogpMappingPage from "./modules/quality/cogp/CogpMappingPage";
import DowntimeSettingsPage from "./modules/quality/downtime-settings/DowntimeSettingsPage";
import PmpPage from "./modules/maintenance/pmp/PmpPage";
import DownEquipmentPage from "./modules/maintenance/down-equipment/DownEquipmentPage";
import { ProblemListPage } from "./modules/quality/problem-control/pages/ProlemListPage";
import { ProblemWizardPage } from "./modules/quality/problem-control/pages/ProblemWizardPage";
import { ProblemEntryPage } from "./modules/quality/problem-control/pages/ProblemEntryPage";
import { ProblemApprovalPage } from "./modules/quality/problem-control/pages/ProblemApprovalPage";
import AuditPage from "./modules/admin/AuditPage";
import FailureCatalogPage from "./modules/quality/qwall/catalog/FailureCatalogPage";
import QWallSettingsPage from "./modules/qwall-settings/index";
import HelpPage from "./modules/quality/qwall/HelpPage";
import IncomingInspectionPage from "./modules/incoming-inspection/IncomingInspectionPage";
import DowntimePage from "./modules/quality/downtime/DowntimePage";
import ScrapRatePage from "./modules/quality/cogp/ScrapRatePage";

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

function Dashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <div style={styles.container}>
      <img src="/logoSSIclaro.png" style={styles.logo} alt="logo" />
      <div style={styles.content}>
        <h1 style={styles.title}>{greeting}{user?.full_name ? `, ${user.full_name}` : ""}</h1>
        <p style={styles.subtitle}>{now.toLocaleString()}</p>
        <p style={styles.subtitle}>{user?.role_display || "Usuario"} · {user?.plant || "Sin planta asignada"}</p>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PermissionRoute({
  module,
  action = "view",
  children,
}: {
  module: ModuleKey;
  action?: ActionKey;
  children: React.ReactNode;
}) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return hasPermission(module, action)
    ? <>{children}</>
    : <Navigate to="/" replace />;
}

const withPermission = (
  module: ModuleKey,
  element: React.ReactNode,
  action: ActionKey = "view",
) => (
  <PermissionRoute module={module} action={action}>
    {element}
  </PermissionRoute>
);

function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/production/ops-daily-report" element={withPermission("production", <OpsReportPage />)} />
        <Route path="/production/targets" element={withPermission("production", <TargetsPage />)} />
        <Route path="/production/safety" element={withPermission("production", <SafetyPage />)} />
        <Route path="/production/assistance" element={withPermission("production", <AssistancePage />)} />
        <Route path="/production/leysilla" element={withPermission("production", <LeysillaPage />)} />
        <Route path="/maintenance/orders" element={withPermission("maintenance", <div>Órdenes de Mantenimiento</div>)} />
        <Route path="/settings/users" element={withPermission("administration", <UsersPage />)} />
        <Route path="/settings/roles" element={withPermission("administration", <RolesPage />)} />
        <Route path="/settings/audit" element={withPermission("administration", <AuditPage />)} />
        <Route path="/settings/plant" element={withPermission("administration", <div>Planta</div>)} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<div>Configuración</div>} />
        <Route path="/warehouse/ctb" element={withPermission("warehouse", <ClearToBuildPage />)} />
        <Route path="/warehouse/demand" element={withPermission("warehouse", <DemandPage />)} />
        <Route path="/maintenance/overview" element={withPermission("maintenance", <OverviewPage />)} />
        <Route path="/maintenance/actions" element={withPermission("maintenance", <div>Actions — próximamente</div>)} />
        <Route path="/maintenance/workcenter" element={withPermission("maintenance", <div>Workcenter Detail — próximamente</div>)} />
        <Route path="/maintenance/work-requests" element={withPermission("maintenance", <WorkRequestsPage />)} />
        <Route path="/quality/dashboard" element={withPermission("quality", <QualityDashboard />)} />
        <Route path="/quality/panel" element={withPermission("quality", <QualityPanelPage />)} />
        <Route path="/operational-panel" element={withPermission("production", <OperationalPanelPage />)} />
        <Route path="/maintenance/corrective-actions" element={withPermission("maintenance", <CorrectiveActionsPage />)} />
        <Route path="/quality/qwall" element={withPermission("quality", <QWallPage />)} />
        <Route path="/quality/qwall-dashboard" element={withPermission("quality", <QWallDashboardPage />)} />
        <Route path="/quality/rejections" element={withPermission("quality", <RejectionReportPage />)} />
        <Route path="/quality/downtime" element={withPermission("quality", <DowntimePage />)} />

        <Route path="/quality/problems" element={withPermission("quality", <ProblemListPage />)} />
        <Route path="/quality/problems/new" element={withPermission("quality", <ProblemWizardPage />, "create")} />
        <Route path="/quality/problems/:id" element={withPermission("quality", <ProblemEntryPage />)} />
        <Route path="/quality/problems/:id/edit" element={withPermission("quality", <ProblemWizardPage />, "edit")} />
        <Route path="/quality/problems/:id/approval" element={withPermission("quality", <ProblemApprovalPage />)} />

        <Route path="/quality/qwall/catalog" element={withPermission("quality", <FailureCatalogPage />)} />
        <Route path="/quality/qwall/settings" element={withPermission("quality", <QWallSettingsPage />, "edit")} />
        <Route path="/quality/qwall/help" element={withPermission("quality", <HelpPage />)} />
        <Route path="/quality/incoming-inspection" element={withPermission("quality", <IncomingInspectionPage />)} />
        <Route path="/quality/cogp" element={withPermission("quality", <CogpDashboardPage />)} />
        <Route path="/quality/cogp/mapping" element={withPermission("quality", <CogpMappingPage />, "edit")} />
        <Route path="/quality/downtime/settings" element={withPermission("quality", <DowntimeSettingsPage />, "edit")} />
        <Route path="/quality/scrap-rate" element={withPermission("quality", <ScrapRatePage />)} />
        <Route path="/maintenance/pmp" element={withPermission("maintenance", <PmpPage />)} />
        <Route path="/maintenance/down-equipment" element={withPermission("maintenance", <DownEquipmentPage />)} />
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
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/*" element={<PrivateRoute><AppRoutes /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { position: "relative", padding: "2rem", borderRadius: "16px", overflow: "visible", background: "var(--color-bg-primary)" },
  logo: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, 190px)", width: "60%", opacity: 0.10, pointerEvents: "none" },
  content: { position: "relative", zIndex: 1 },
  title: { color: "var(--color-text-primary)", fontSize: "1.8rem", fontWeight: 600, marginBottom: "0.3rem" },
  subtitle: { color: "var(--color-text-secondary)", fontSize: "1rem", marginBottom: "0.5rem" },
  meta: { color: "var(--color-text-secondary)", fontSize: "0.85rem", opacity: 0.7 },
};
