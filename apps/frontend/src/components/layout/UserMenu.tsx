import { useEffect, useRef } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../modules/auth/useAuth";

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export default function UserMenu({ isOpen, onClose, onNavigate }: UserMenuProps) {
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <div ref={menuRef} style={styles.menu}>
      <div style={styles.header}>
        <div style={styles.avatar}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          ) : (
            user?.full_name?.charAt(0).toUpperCase() ?? "U"
          )}
        </div>
        <div style={styles.info}>
          <span style={styles.name}>{user?.full_name}</span>
          <span style={styles.employeeId}>#{user?.employee_id}</span>
          {user?.email && <span style={styles.email}>{user.email}</span>}
        </div>
      </div>

      <div style={styles.divider} />

      <button style={styles.item} onClick={() => { onNavigate("/profile"); onClose(); }}>
        <Icons.User size={16} />
        <span>{t("userMenu.profile")}</span>
      </button>

      <button style={styles.item} onClick={() => { onNavigate("/settings"); onClose(); }}>
        <Icons.Settings size={16} />
        <span>{t("userMenu.settings")}</span>
      </button>

      <div style={styles.divider} />

      <div style={styles.plantInfo}>
        <Icons.Building2 size={14} />
        <span style={styles.plantLabel}>{user?.plant || t("userMenu.noPlant")}</span>
      </div>

      <div style={styles.divider} />

      <button style={{ ...styles.item, ...styles.logoutItem }} onClick={handleLogout}>
        <Icons.LogOut size={16} />
        <span>{t("userMenu.logout")}</span>
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: "absolute", top: "68px", right: "1.5rem", width: "260px",
    backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 1000, overflow: "hidden",
  },
  header: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", backgroundColor: "var(--color-bg)" },
  avatar: {
    width: "40px", height: "40px", borderRadius: "50%",
    backgroundColor: "var(--color-primary)", color: "#ffffff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1rem", fontWeight: "700", flexShrink: 0, overflow: "hidden",
  },
  info: { display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" },
  name: { fontSize: "0.875rem", fontWeight: "600", color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  employeeId: { fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  email: { fontSize: "0.75rem", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  divider: { height: "1px", backgroundColor: "var(--color-border)" },
  item: {
    width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "0.75rem 1rem", background: "none", border: "none",
    cursor: "pointer", color: "var(--color-text-primary)", fontSize: "0.875rem", textAlign: "left",
  },
  logoutItem: { color: "var(--color-stopped)" },
  plantInfo: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1rem", color: "var(--color-text-secondary)", fontSize: "0.775rem" },
  plantLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
};