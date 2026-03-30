import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react";
import { useSidebar } from "../../navigation";
import { UserRole } from "../../navigation/types";
import { useTheme } from "../../navigation/useTheme";

interface SidebarProps {
  userRole: UserRole;
}

const resolvedTheme = document.documentElement.getAttribute("data-theme") ?? "light";
function DynamicIcon({ name }: { name: string }) {
  const Icon = (Icons as any)[name];
  if (!Icon) return <Icons.Circle size={18} />;
  return <Icon size={18} />;
}

export default function Sidebar({ userRole }: SidebarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    visibleSections,
    toggleSection,
    setActive,
    toggleCollapse,
    isSectionExpanded,
    isItemActive,
    state,
  } = useSidebar(userRole);

  const handleItemClick = (itemId: string, sectionId: string, path: string) => {
    setActive(itemId, sectionId);
    navigate(path);
  };

  return (
    <aside style={{
      ...styles.sidebar,
      width: state.isCollapsed ? "64px" : "240px",
    }}>
      <div style={styles.header}>
  {!state.isCollapsed && (
  <img
    src={resolvedTheme === "dark" ? "/logoSSIoscuro.png" : "/logoSSIclaro.png"}
    alt="SSI Platform"
    style={styles.logo}
  />
)}
  <button style={styles.collapseBtn} onClick={toggleCollapse}>
    {state.isCollapsed
      ? <Icons.ChevronRight size={18} />
      : <Icons.ChevronLeft size={18} />
    }
  </button>
</div>

      {/* Nav sections */}
      <nav style={styles.nav}>
        {visibleSections.map((section) => {
          const expanded = isSectionExpanded(section.id);
          return (
            <div key={section.id} style={styles.section}>
              <button
                style={styles.sectionBtn}
                onClick={() => toggleSection(section.id)}
                title={state.isCollapsed ? t(section.labelKey) : undefined}
              >
                <span style={styles.sectionIcon}>
                  <DynamicIcon name={section.icon} />
                </span>
                {!state.isCollapsed && (
                  <>
                    <span style={styles.sectionLabel}>
                      {t(section.labelKey)}
                    </span>
                    <span style={styles.chevron}>
                      {expanded
                        ? <Icons.ChevronDown size={14} />
                        : <Icons.ChevronRight size={14} />
                      }
                    </span>
                  </>
                )}
              </button>

              {expanded && !state.isCollapsed && (
                <div style={styles.items}>
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      style={{
                        ...styles.itemBtn,
                        ...(isItemActive(item.id) ? styles.itemActive : {}),
                      }}
                      onClick={() =>
                        handleItemClick(item.id, section.id, item.path)
                      }
                    >
                      <span style={styles.itemIcon}>
                        <DynamicIcon name={item.icon} />
                      </span>
                      <span style={styles.itemLabel}>
                        {t(item.labelKey)}
                      </span>
                      {item.badge ? (
                        <span style={styles.badge}>{item.badge}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    height: "100vh",
    backgroundColor: "var(--color-surface)",
    borderRight: "1px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.2s ease",
    overflow: "hidden",
    flexShrink: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem",
    borderBottom: "1px solid var(--color-border)",
    minHeight: "60px",
  },
  brandName: {
    fontWeight: "700",
    fontSize: "0.95rem",
    color: "var(--color-primary)",
    whiteSpace: "nowrap",
  },
  collapseBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
    padding: "4px",
    borderRadius: "var(--radius-sm)",
  },
  nav: {
    flex: 1,
    overflowY: "auto",
    padding: "0.5rem 0",
  },
  section: {
    marginBottom: "2px",
  },
  sectionBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    padding: "0.625rem 1rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-primary)",
    fontSize: "0.875rem",
    fontWeight: "600",
    textAlign: "left",
  },
  sectionIcon: {
    display: "flex",
    alignItems: "center",
    color: "var(--color-text-secondary)",
    flexShrink: 0,
  },
  sectionLabel: {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chevron: {
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
  },
  items: {
    paddingLeft: "1rem",
  },
  itemBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    padding: "0.5rem 0.75rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    fontSize: "0.825rem",
    borderRadius: "var(--radius-md)",
    textAlign: "left",
  },
  itemActive: {
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
  },
  itemIcon: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  itemLabel: {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  badge: {
    backgroundColor: "var(--color-accent)",
    color: "#000",
    borderRadius: "999px",
    fontSize: "0.7rem",
    fontWeight: "700",
    padding: "1px 6px",
    flexShrink: 0,
  },
  logo: {
  height: "32px",
  width: "auto",
  objectFit: "contain" as const,
  maxWidth: "150px",
},
};