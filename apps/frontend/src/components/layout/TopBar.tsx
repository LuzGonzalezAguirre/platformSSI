import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../navigation";
import { Theme } from "../../navigation/types";

interface TopBarProps {
  onUserMenuClick: () => void;
  userFullName: string;
  userRole: string;
  userAvatarUrl?: string | null;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export default function TopBar({
  onUserMenuClick,
  userFullName,
  userRole,
  userAvatarUrl,
  currentLanguage,
  onLanguageChange,
}: TopBarProps) {
  const { t } = useTranslation();
  const { setTheme, theme } = useTheme();

  const cycleTheme = () => {
    const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
    setTheme(next[theme]);
  };

  const themeIcon = {
    light: <Icons.Sun size={18} />,
    dark: <Icons.Moon size={18} />,
    system: <Icons.Monitor size={18} />,
  }[theme];

  const themeLabel = {
    light: t("profile.themes.light"),
    dark: t("profile.themes.dark"),
    system: t("profile.themes.system"),
  }[theme];

  return (
    <header style={styles.topbar}>
      <div style={styles.left}>
        <span style={styles.breadcrumb}>SSI Platform</span>
      </div>

      <div style={styles.right}>
        <button
          style={styles.controlBtn}
          onClick={() => onLanguageChange(currentLanguage === "es" ? "en" : "es")}
          title={t("profile.fields.language")}
        >
          <Icons.Globe size={18} />
          <span style={styles.controlLabel}>{currentLanguage.toUpperCase()}</span>
        </button>

        <button style={styles.controlBtn} onClick={cycleTheme} title={themeLabel}>
          {themeIcon}
          <span style={styles.controlLabel}>{themeLabel}</span>
        </button>

        <button style={styles.controlBtn} title="Notificaciones">
          <Icons.Bell size={18} />
        </button>

        <button style={styles.userBtn} onClick={onUserMenuClick}>
          <div style={styles.avatar}>
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            ) : (
              userFullName.charAt(0).toUpperCase()
            )}
          </div>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{userFullName}</span>
            <span style={styles.userRole}>{userRole}</span>
          </div>
          <Icons.ChevronDown size={14} />
        </button>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topbar: {
    height: "60px", backgroundColor: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)", display: "flex",
    alignItems: "center", justifyContent: "space-between",
    padding: "0 1.5rem", flexShrink: 0,
  },
  left: { display: "flex", alignItems: "center", gap: "0.5rem" },
  breadcrumb: { fontSize: "0.95rem", fontWeight: "600", color: "var(--color-text-primary)" },
  right: { display: "flex", alignItems: "center", gap: "0.5rem" },
  controlBtn: {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.375rem 0.75rem", background: "transparent",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
    cursor: "pointer", color: "var(--color-text-secondary)", fontSize: "0.825rem",
  },
  controlLabel: { fontSize: "0.8rem", fontWeight: "600" },
  userBtn: {
    display: "flex", alignItems: "center", gap: "0.625rem",
    padding: "0.375rem 0.75rem", background: "transparent",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
    cursor: "pointer", color: "var(--color-text-primary)", marginLeft: "0.5rem",
  },
  avatar: {
    width: "30px", height: "30px", borderRadius: "50%",
    backgroundColor: "var(--color-primary)", color: "#ffffff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.875rem", fontWeight: "700", flexShrink: 0, overflow: "hidden",
  },
  userInfo: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  userName: { fontSize: "0.825rem", fontWeight: "600", color: "var(--color-text-primary)", whiteSpace: "nowrap" },
  userRole: { fontSize: "0.725rem", color: "var(--color-text-secondary)", whiteSpace: "nowrap" },
};