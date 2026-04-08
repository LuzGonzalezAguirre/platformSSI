import { useState, useRef, useCallback } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import apiClient from "../../services/api.client";
import { useTheme } from "../../navigation/useTheme";
import { UsersService } from "../../services/users.service";

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  preferred_language: string;
  preferred_theme: string;
  timezone: string;
}

const TIMEZONES = [
  "America/Tijuana", "America/Mexico_City", "America/Monterrey",
  "America/Chicago", "America/New_York", "America/Los_Angeles",
  "America/Detroit", "UTC",
];

const MODULE_ICONS: Record<string, string> = {
  production:     "Factory",
  quality:        "BadgeCheck",
  maintenance:    "Wrench",
  warehouse:      "Warehouse",
  administration: "ShieldCheck",
};

function DynamicIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Icon = (Icons as any)[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

function Avatar({
  src, initials, size = 64, isEditing, onImageChange,
}: {
  src: string | null;
  initials: string;
  size?: number;
  isEditing: boolean;
  onImageChange?: (base64: string, file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onImageChange?.(reader.result, file);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        backgroundColor: src ? "transparent" : "var(--color-primary)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: "700", overflow: "hidden",
        border: "3px solid var(--color-border)",
      }}>
        {src
          ? <img src={src} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initials
        }
      </div>
      {isEditing && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: "50%",
              backgroundColor: "var(--color-primary)",
              border: "2px solid var(--color-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <Icons.Camera size={12} />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: "none" }} />
        </>
      )}
    </div>
  );
}

function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={sectionStyles.card}>
      <div style={sectionStyles.header}>
        <span style={sectionStyles.icon}>{icon}</span>
        <div>
          <div style={sectionStyles.title}>{title}</div>
          {subtitle && <div style={sectionStyles.subtitle}>{subtitle}</div>}
        </div>
      </div>
      <div style={sectionStyles.body}>{children}</div>
    </div>
  );
}

const sectionStyles: Record<string, React.CSSProperties> = {
  card: { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  icon: { color: "var(--color-primary)", display: "flex" },
  title: { fontSize: "0.95rem", fontWeight: "700", color: "var(--color-text-primary)" },
  subtitle: { fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: "0.1rem" },
  body: { padding: "1.5rem" },
};

function formatLastLogin(isoString: string | null | undefined, t: (key: string) => string): string {
  if (!isoString) return t("profile.lastAccessNever");
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 2) return t("profile.lastAccessJustNow");
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return t("profile.lastAccessYesterday");
  return date.toLocaleDateString();
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { theme, setTheme } = useTheme();

  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join("").toUpperCase() || user?.employee_id?.[0]?.toUpperCase() || "U";

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState<string | null>(user?.avatar_url || null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [form, setForm] = useState<ProfileForm>({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    preferred_language: user?.preferred_language || "es",
    preferred_theme: user?.preferred_theme || theme,
    timezone: user?.timezone || "America/Tijuana",
  });
  const [savedForm, setSavedForm] = useState<ProfileForm>({ ...form });

  const handleEdit = () => {
    setSavedForm({ ...form });
    setAvatarPreview(avatarSrc);
    setIsEditing(true);
    setMsg(null);
  };

  const handleCancel = () => {
    setForm({ ...savedForm });
    setAvatarPreview(null);
    setAvatarFile(null);
    setIsEditing(false);
    setMsg(null);
  };

  const handleAvatarChange = useCallback((base64: string, file: File) => {
    setAvatarPreview(base64);
    setAvatarFile(file);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const response = await apiClient.patch("/auth/me/update/", {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        preferred_language: form.preferred_language,
        preferred_theme: form.preferred_theme,
        timezone: form.timezone,
      });

      setAuth(useAuthStore.getState().access!, useAuthStore.getState().refresh!, response.data);

      if (avatarFile) {
        const updated = await UsersService.uploadAvatar(avatarFile);
        setAvatarSrc(updated.avatar_url);
        setAvatarFile(null);
        setAuth(useAuthStore.getState().access!, useAuthStore.getState().refresh!, updated);
      }

      setTheme(form.preferred_theme as any);
      setSavedForm({ ...form });
      setIsEditing(false);
      setMsg({ type: "success", text: t("profile.messages.updateSuccess") });
    } catch (err: any) {
      const data = err.response?.data;
      if (typeof data === "object") {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(" | ");
        setMsg({ type: "error", text: msgs });
      } else {
        setMsg({ type: "error", text: t("profile.messages.updateError") });
      }
    } finally {
      setLoading(false);
    }
  };

  const currentAvatarSrc = isEditing ? (avatarPreview || avatarSrc) : avatarSrc;

  const userPermissions = user?.permissions ?? {};
  const permissionModules = (Object.entries(userPermissions) as [string, string[]][]).filter(([, actions]) => actions.length > 0);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Avatar
            src={currentAvatarSrc}
            initials={initials}
            size={72}
            isEditing={isEditing}
            onImageChange={handleAvatarChange}
          />
          <div>
            <div style={styles.headerName}>{user?.full_name || user?.employee_id}</div>
            <div style={styles.headerMeta}>
              {user?.roles?.map((r) => (
                <span key={r.slug} style={styles.roleBadge}>
                  {t(`roles.${r.slug}`, { defaultValue: r.name })}
                </span>
              ))}
              {user?.plant && (
                <span style={styles.headerDetail}>
                  <Icons.Building2 size={13} />{user.plant}
                </span>
              )}
              <span style={styles.headerDetail}>
                <Icons.Clock size={13} />
                {formatLastLogin(user?.last_login_at, t)}
              </span>
            </div>
          </div>
        </div>
        <div style={styles.headerActions}>
          {!isEditing ? (
            <button style={styles.editBtn} onClick={handleEdit}>
              <Icons.Pencil size={15} /><span>{t("profile.editProfile")}</span>
            </button>
          ) : (
            <>
              <button style={styles.cancelBtn} onClick={handleCancel} disabled={loading}>
                <Icons.X size={15} /><span>{t("profile.cancel")}</span>
              </button>
              <button style={styles.saveBtn} onClick={handleSave} disabled={loading}>
                {loading ? <Icons.Loader2 size={15} /> : <Icons.Check size={15} />}
                <span>{loading ? t("common.loading") : t("profile.save")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div style={{
          padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", fontSize: "0.875rem",
          color: msg.type === "success" ? "var(--color-running)" : "var(--color-stopped)",
          backgroundColor: msg.type === "success" ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
          border: `1px solid ${msg.type === "success" ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`,
        }}>
          {msg.text}
        </div>
      )}

      <div style={styles.grid}>
        {/* Left column */}
        <div style={styles.column}>
          <Section
            icon={<Icons.User size={18} />}
            title={t("profile.sections.personalInfo")}
            subtitle={t("profile.sections.personalInfoSub")}
          >
            <div style={styles.fieldsGrid}>
              <div style={styles.fieldWrap}>
                <label style={styles.fieldLabel}>{t("profile.fields.firstName")}</label>
                {isEditing
                  ? <input style={styles.input} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  : <div style={styles.readValue}>{form.first_name || "—"}</div>
                }
              </div>
              <div style={styles.fieldWrap}>
                <label style={styles.fieldLabel}>{t("profile.fields.lastName")}</label>
                {isEditing
                  ? <input style={styles.input} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  : <div style={styles.readValue}>{form.last_name || "—"}</div>
                }
              </div>
              <div style={styles.fieldWrap}>
                <label style={styles.fieldLabel}>{t("profile.fields.employeeId")}</label>
                <div style={{ ...styles.readValue, ...styles.readDisabled }}>#{user?.employee_id}</div>
              </div>
              <div style={styles.fieldWrap}>
                <label style={styles.fieldLabel}>{t("profile.fields.email")}</label>
                {isEditing
                  ? <input style={styles.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@empresa.com" />
                  : <div style={styles.readValue}>{form.email || "—"}</div>
                }
              </div>
            </div>
          </Section>

          <Section
            icon={<Icons.Shield size={18} />}
            title={t("profile.sections.security")}
            subtitle={t("profile.sections.securitySub")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={styles.securityRow}>
                <div>
                  <div style={styles.securityLabel}>{t("profile.security.changePassword")}</div>
                  <div style={styles.securitySub}>{t("profile.security.changePasswordSub")}</div>
                </div>
                <button style={styles.securityBtn} onClick={() => setShowPasswordModal(true)}>
                  <Icons.KeyRound size={14} /><span>{t("profile.security.change")}</span>
                </button>
              </div>
              <div style={styles.divider} />
              <div style={styles.securityRow}>
                <div>
                  <div style={styles.securityLabel}>{t("profile.security.activeSessions")}</div>
                  <div style={styles.securitySub}>{t("profile.security.activeSessionsSub")}</div>
                </div>
                <span style={styles.activeBadge}>1 {t("profile.security.active")}</span>
              </div>
              <div style={styles.sessionRow}>
                <Icons.Monitor size={14} style={{ color: "var(--color-text-secondary)" }} />
                <span style={{ fontSize: "0.825rem", color: "var(--color-text-secondary)" }}>
                  {t("profile.security.currentSession")}
                </span>
                <span style={styles.currentBadge}>{t("profile.security.current")}</span>
              </div>
            </div>
          </Section>
        </div>

        {/* Right column */}
        <div style={styles.column}>
          <Section
            icon={<Icons.Settings size={18} />}
            title={t("profile.sections.accountSettings")}
            subtitle={t("profile.sections.accountSettingsSub")}
          >
            <div style={styles.fieldsGrid}>
              <div style={styles.fieldWrap}>
                <label style={styles.fieldLabel}>{t("profile.fields.language")}</label>
                {isEditing
                  ? (
                    <select style={styles.input} value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
                      <option value="es">{t("profile.languages.es")}</option>
                      <option value="en">{t("profile.languages.en")}</option>
                    </select>
                  )
                  : <div style={styles.readValue}>{t(`profile.languages.${form.preferred_language}`)}</div>
                }
              </div>
              <div style={styles.fieldWrap}>
                <label style={styles.fieldLabel}>{t("profile.fields.theme")}</label>
                {isEditing
                  ? (
                    <select style={styles.input} value={form.preferred_theme} onChange={(e) => setForm({ ...form, preferred_theme: e.target.value })}>
                      <option value="light">{t("profile.themes.light")}</option>
                      <option value="dark">{t("profile.themes.dark")}</option>
                      <option value="system">{t("profile.themes.system")}</option>
                    </select>
                  )
                  : <div style={styles.readValue}>{t(`profile.themes.${form.preferred_theme}`)}</div>
                }
              </div>
              <div style={styles.fieldWrap}>
                <label style={styles.fieldLabel}>{t("profile.fields.timezone")}</label>
                {isEditing
                  ? (
                    <select style={styles.input} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  )
                  : <div style={styles.readValue}>{form.timezone}</div>
                }
              </div>
            </div>
          </Section>

          <Section
            icon={<Icons.Monitor size={18} />}
            title={t("profile.sections.systemInfo")}
            subtitle={t("profile.sections.systemInfoSub")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={styles.sysGrid}>
                <div>
                  <div style={styles.sysLabel}>{t("profile.fields.role")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {user?.roles?.length ? (
                      user.roles.map((r) => (
                        <span key={r.slug} style={styles.roleBadge}>
                          {t(`roles.${r.slug}`, { defaultValue: r.name })}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "0.825rem" }}>—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={styles.sysLabel}>{t("profile.fields.accountStatus")}</div>
                  <span style={styles.activeBadge}>
                    <Icons.CheckCircle size={12} />{t("profile.status.active")}
                  </span>
                </div>
                <div>
                  <div style={styles.sysLabel}>{t("profile.fields.assignedPlant")}</div>
                  <div style={styles.readValue}>{user?.plant || t("profile.unassigned")}</div>
                </div>
                <div>
                  <div style={styles.sysLabel}>{t("profile.fields.employeeId")}</div>
                  <div style={{ ...styles.readValue, fontFamily: "monospace" }}>#{user?.employee_id}</div>
                </div>
              </div>
              <div style={styles.divider} />

              
            </div>
          </Section>
        </div>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await apiClient.post("/auth/me/change-password/", form);
      setMsg({ type: "success", text: t("profile.messages.passwordSuccess") });
      setTimeout(onClose, 1500);
    } catch (err: any) {
      const data = err.response?.data;
      if (typeof data === "object") {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(" | ");
        setMsg({ type: "error", text: msgs });
      } else {
        setMsg({ type: "error", text: t("profile.messages.passwordError") });
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldLabels: Record<string, string> = {
    current_password: t("profile.modal.currentPassword"),
    new_password:     t("profile.modal.newPassword"),
    confirm_password: t("profile.modal.confirmPassword"),
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{t("profile.modal.changePasswordTitle")}</h2>
          <button style={modalStyles.closeBtn} onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={modalStyles.body}>
          {(["current_password", "new_password", "confirm_password"] as const).map((field) => (
            <div key={field} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.825rem", fontWeight: "600", color: "var(--color-text-primary)" }}>
                {fieldLabels[field]}
              </label>
              <input
                style={styles.input}
                type="password"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                minLength={field !== "current_password" ? 8 : undefined}
              />
            </div>
          ))}
          {msg && (
            <p style={{
              fontSize: "0.825rem", padding: "0.625rem 0.75rem", borderRadius: "var(--radius-sm)", margin: 0,
              color: msg.type === "success" ? "var(--color-running)" : "var(--color-stopped)",
              backgroundColor: msg.type === "success" ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
            }}>
              {msg.text}
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={loading}>
              {t("profile.modal.cancel")}
            </button>
            <button type="submit" style={styles.saveBtn} disabled={loading}>
              {loading ? t("common.loading") : t("profile.modal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:         { display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1100px" },
  header:       { display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.5rem", gap: "1rem", flexWrap: "wrap" },
  headerLeft:   { display: "flex", alignItems: "center", gap: "1.25rem" },
  headerName:   { fontSize: "1.3rem", fontWeight: "700", color: "var(--color-text-primary)", marginBottom: "0.375rem" },
  headerMeta:   { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  headerDetail: { display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" },
  headerActions:{ display: "flex", gap: "0.75rem", alignItems: "center" },
  editBtn: {
    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem",
    backgroundColor: "var(--color-primary)", color: "#fff", border: "none",
    borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600",
  },
  saveBtn: {
    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem",
    backgroundColor: "var(--color-primary)", color: "#fff", border: "none",
    borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600",
  },
  cancelBtn: {
    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem",
    backgroundColor: "transparent", color: "var(--color-text-secondary)",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem",
  },
  grid:         { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" },
  column:       { display: "flex", flexDirection: "column", gap: "1.5rem" },
  fieldsGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  fieldWrap:    { display: "flex", flexDirection: "column", gap: "0.375rem" },
  fieldLabel:   { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
  input:        { padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", width: "100%", boxSizing: "border-box" as const },
  readValue:    { padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid transparent", fontSize: "0.875rem", color: "var(--color-text-primary)", minHeight: "38px", display: "flex", alignItems: "center" },
  readDisabled: { color: "var(--color-text-secondary)", fontFamily: "monospace" },
  roleBadge:    { padding: "0.2rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: "600", backgroundColor: "rgba(10,110,189,0.1)", color: "var(--color-primary)", display: "inline-flex", alignItems: "center" },
  activeBadge:  { padding: "0.2rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: "600", backgroundColor: "rgba(22,163,74,0.1)", color: "var(--color-running)", display: "inline-flex", alignItems: "center", gap: "0.3rem" },
  currentBadge: { padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: "600", backgroundColor: "rgba(10,110,189,0.1)", color: "var(--color-primary)" },
  securityRow:  { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" },
  securityLabel:{ fontSize: "0.875rem", fontWeight: "600", color: "var(--color-text-primary)" },
  securitySub:  { fontSize: "0.775rem", color: "var(--color-text-secondary)", marginTop: "0.1rem" },
  securityBtn:  { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.45rem 0.875rem", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.8rem", color: "var(--color-text-primary)", whiteSpace: "nowrap" as const, flexShrink: 0 },
  sessionRow:   { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.75rem", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" },
  sysGrid:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  sysLabel:     { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.375rem" },
  permRow:      { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" },
  permModuleLabel: { display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-primary)", minWidth: "110px" },
  permActionsWrap: { display: "flex", flexWrap: "wrap" as const, gap: "0.375rem" },
  permBadge:    { padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: "500", backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" },
  divider:      { height: "1px", backgroundColor: "var(--color-border)" },
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  modal:   { backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "440px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  header:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  title:   { fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  closeBtn:{ backgroundColor: "transparent", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex", alignItems: "center" },
  body:    { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
};