import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import UserMenu from "./UserMenu";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../navigation/types";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      i18n.changeLanguage(lang);
      localStorage.setItem("mes_language", lang);
    },
    [i18n]
  );

  const handleUserMenuNavigate = useCallback(
    (path: string) => navigate(path),
    [navigate]
  );

  if (!user) return null;

  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <Sidebar userRole={"admin" as UserRole} />

      {/* Main area */}
      <div style={styles.main}>
        {/* TopBar */}
        <TopBar
  onUserMenuClick={() => setUserMenuOpen((v) => !v)}
  userFullName={user.full_name || user.employee_id}
  userRole={user.job_title || user.role_display}
  userAvatarUrl={user.avatar_url}
  currentLanguage={i18n.language}
  onLanguageChange={handleLanguageChange}
/>

        {/* User dropdown menu */}
        <UserMenu
          isOpen={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
          onNavigate={handleUserMenuNavigate}
        />

        {/* Page content */}
        <main style={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "var(--color-bg)",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "1.5rem 2rem",
    maxWidth: "1600px",
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box" as const,
},
};