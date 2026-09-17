import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";

import { notificationApi } from "./notificationApi";
import type { AppNotification, NotificationScope } from "./types";

interface NotificationCenterProps {
  language: string;
}

export default function NotificationCenter({ language }: NotificationCenterProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<NotificationScope>("all");

  const feedQuery = useQuery({
    queryKey: ["notifications", scope],
    queryFn: () => notificationApi.getFeed(scope),
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  const invalidateFeed = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: notificationApi.markRead, onSuccess: invalidateFeed });
  const markAllRead = useMutation({ mutationFn: notificationApi.markAllRead, onSuccess: invalidateFeed });

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const openNotification = (notification: AppNotification) => {
    if (!notification.read_at) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.action_url) navigate(notification.action_url);
  };

  const locale = language.startsWith("es") ? "es-MX" : "en-US";
  const counts = feedQuery.data?.counts ?? { unread: 0, pending: 0 };

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        type="button"
        style={styles.bellButton}
        title={language.startsWith("es") ? "Notificaciones" : "Notifications"}
        aria-label={language.startsWith("es") ? "Abrir notificaciones" : "Open notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icons.Bell size={18} />
        {counts.unread > 0 && <span style={styles.badge}>{counts.unread > 99 ? "99+" : counts.unread}</span>}
      </button>

      {open && (
        <section style={styles.panel} aria-label="Notification center">
          <div style={styles.header}>
            <div>
              <div style={styles.title}>{language.startsWith("es") ? "Centro de notificaciones" : "Notification center"}</div>
              <div style={styles.subtitle}>
                {counts.unread} {language.startsWith("es") ? "nuevas" : "new"} · {counts.pending} {language.startsWith("es") ? "pendientes" : "pending"}
              </div>
            </div>
            {counts.unread > 0 && (
              <button type="button" style={styles.textButton} onClick={() => markAllRead.mutate()}>
                {language.startsWith("es") ? "Marcar leídas" : "Mark all read"}
              </button>
            )}
          </div>

          <div style={styles.tabs}>
            <Tab active={scope === "all"} onClick={() => setScope("all")}>
              {language.startsWith("es") ? "Notificaciones" : "Notifications"}
            </Tab>
            <Tab active={scope === "pending"} onClick={() => setScope("pending")}>
              {language.startsWith("es") ? "Pendientes" : "Pending"} ({counts.pending})
            </Tab>
          </div>

          <div style={styles.list}>
            {feedQuery.isLoading ? (
              <div style={styles.empty}>{language.startsWith("es") ? "Cargando…" : "Loading…"}</div>
            ) : feedQuery.isError ? (
              <div style={styles.empty}>{language.startsWith("es") ? "No fue posible cargar las notificaciones." : "Unable to load notifications."}</div>
            ) : feedQuery.data?.results.length ? (
              feedQuery.data.results.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  style={{ ...styles.item, ...(!notification.read_at ? styles.itemUnread : {}) }}
                  onClick={() => openNotification(notification)}
                >
                  <span style={{ ...styles.icon, ...(notification.is_pending ? styles.iconPending : {}) }}>
                    {notification.is_pending ? <Icons.ClipboardCheck size={17} /> : <Icons.BellRing size={17} />}
                  </span>
                  <span style={styles.itemBody}>
                    <span style={styles.itemTopLine}>
                      <span style={styles.itemTitle}>{notification.title}</span>
                      {!notification.read_at && <span style={styles.unreadDot} />}
                    </span>
                    <span style={styles.message}>{notification.message}</span>
                    <span style={styles.meta}>
                      {String(notification.metadata.step || "Problem Control")} · {new Date(notification.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <Icons.ChevronRight size={16} style={styles.chevron} />
                </button>
              ))
            ) : (
              <div style={styles.empty}>
                <Icons.CheckCircle2 size={28} />
                {scope === "pending"
                  ? (language.startsWith("es") ? "No tienes pendientes." : "You have no pending tasks.")
                  : (language.startsWith("es") ? "No tienes notificaciones." : "You have no notifications.")}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}>{children}</button>;
}

const styles: Record<string, React.CSSProperties> = {
  container: { position: "relative" },
  bellButton: { position: "relative", display: "flex", alignItems: "center", padding: "0.375rem 0.75rem", background: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer", color: "var(--color-text-secondary)" },
  badge: { position: "absolute", top: "-7px", right: "-7px", minWidth: "18px", height: "18px", padding: "0 4px", borderRadius: "999px", background: "#dc2626", color: "#fff", border: "2px solid var(--color-surface)", fontSize: "0.65rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
  panel: { position: "absolute", top: "calc(100% + 0.7rem)", right: 0, width: "min(420px, calc(100vw - 2rem))", maxHeight: "min(650px, calc(100vh - 90px))", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "0.8rem", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)", zIndex: 1200, overflow: "hidden" },
  header: { padding: "1rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid var(--color-border)" },
  title: { color: "var(--color-text-primary)", fontSize: "0.95rem", fontWeight: 750 },
  subtitle: { color: "var(--color-text-secondary)", fontSize: "0.75rem", marginTop: "0.2rem" },
  textButton: { border: 0, background: "transparent", color: "var(--color-primary)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 650, padding: "0.2rem" },
  tabs: { display: "flex", padding: "0.55rem 0.8rem 0", gap: "0.35rem" },
  tab: { flex: 1, border: 0, borderBottom: "2px solid transparent", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", padding: "0.55rem", fontSize: "0.78rem", fontWeight: 650 },
  tabActive: { color: "var(--color-primary)", borderBottomColor: "var(--color-primary)" },
  list: { maxHeight: "500px", overflowY: "auto", padding: "0.55rem" },
  item: { width: "100%", display: "flex", alignItems: "flex-start", gap: "0.7rem", textAlign: "left", border: "1px solid transparent", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer", borderRadius: "0.65rem", padding: "0.75rem", marginBottom: "0.25rem" },
  itemUnread: { background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))", borderColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)" },
  icon: { width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#dbeafe", color: "#2563eb" },
  iconPending: { background: "#fef3c7", color: "#d97706" },
  itemBody: { minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "0.22rem" },
  itemTopLine: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" },
  itemTitle: { fontSize: "0.8rem", fontWeight: 720 },
  unreadDot: { width: "7px", height: "7px", borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0 },
  message: { color: "var(--color-text-secondary)", fontSize: "0.75rem", lineHeight: 1.4, overflowWrap: "anywhere" },
  meta: { color: "var(--color-text-secondary)", opacity: 0.8, fontSize: "0.68rem" },
  chevron: { color: "var(--color-text-secondary)", flexShrink: 0, marginTop: "0.45rem" },
  empty: { minHeight: "150px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.6rem", color: "var(--color-text-secondary)", fontSize: "0.8rem", textAlign: "center", padding: "1rem" },
};
