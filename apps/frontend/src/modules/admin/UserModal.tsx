import { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import { User, RoleChoice } from "../../services/users.service";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  user?: User | null;
  roles: RoleChoice[];
  mode: "create" | "edit" | "reset-password";
}

export default function UserModal({ isOpen, onClose, onSubmit, user, roles, mode }: UserModalProps) {
  const [form, setForm] = useState<any>({});
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "create") {
      setForm({ employee_id: "", first_name: "", last_name: "", email: "", plant: "", preferred_language: "es", password: "" });
      setSelectedRoles([]);
    } else if (mode === "edit" && user) {
      setForm({ first_name: user.first_name, last_name: user.last_name, email: user.email, plant: user.plant, preferred_language: user.preferred_language });
      setSelectedRoles(user.roles?.map((r) => r.slug) ?? []);
    } else if (mode === "reset-password") {
      setForm({ new_password: "", confirm_password: "" });
    }
    setError(null);
  }, [isOpen, mode, user]);

  if (!isOpen) return null;

  const toggleRole = (slug: string) => {
    setSelectedRoles((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== "reset-password" && selectedRoles.length === 0) {
      setError("Debes asignar al menos un rol.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = mode === "reset-password" ? form : { ...form, roles: selectedRoles };
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      const data = err.response?.data;
      if (typeof data === "object") {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
          .join(" | ");
        setError(msgs);
      } else {
        setError("Error al guardar.");
      }
    } finally {
      setLoading(false);
    }
  };

  const titles = { create: "Crear Usuario", edit: "Editar Usuario", "reset-password": "Resetear Contraseña" };

  const systemRoles = roles.filter((r) => r.is_system);
  const customRoles = roles.filter((r) => !r.is_system);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.title}>{titles[mode]}</h2>
          <button style={s.closeBtn} onClick={onClose}><Icons.X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          {mode !== "reset-password" && (
            <>
              {mode === "create" && (
                <div style={s.field}>
                  <label style={s.label}>Número de Empleado *</label>
                  <input style={s.input} value={form.employee_id || ""} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="Ej. 840934" required />
                </div>
              )}

              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Nombre *</label>
                  <input style={s.input} value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Apellido *</label>
                  <input style={s.input} value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>
                  Roles *
                  <span style={s.labelHint}>{selectedRoles.length} seleccionado{selectedRoles.length !== 1 ? "s" : ""}</span>
                </label>
                <div style={s.rolesBox}>
                  {systemRoles.length > 0 && (
                    <div style={s.roleGroup}>
                      <span style={s.roleGroupLabel}>Roles de sistema</span>
                      <div style={s.roleGrid}>
                        {systemRoles.map((r) => {
                          const active = selectedRoles.includes(r.value);
                          return (
                            <button
                              key={r.value}
                              type="button"
                              style={{ ...s.roleChip, ...(active ? s.roleChipActive : {}) }}
                              onClick={() => toggleRole(r.value)}
                            >
                              <Icons.ShieldCheck size={13} />
                              <span>{r.label}</span>
                              {active && <Icons.Check size={12} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {customRoles.length > 0 && (
                    <div style={s.roleGroup}>
                      <span style={s.roleGroupLabel}>Roles personalizados</span>
                      <div style={s.roleGrid}>
                        {customRoles.map((r) => {
                          const active = selectedRoles.includes(r.value);
                          return (
                            <button
                              key={r.value}
                              type="button"
                              style={{ ...s.roleChip, ...(active ? s.roleChipActive : {}) }}
                              onClick={() => toggleRole(r.value)}
                            >
                              <Icons.Shield size={13} />
                              <span>{r.label}</span>
                              {active && <Icons.Check size={12} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Planta</label>
                  <input style={s.input} value={form.plant || ""} onChange={(e) => setForm({ ...form, plant: e.target.value })} placeholder="Ej. Tijuana" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Idioma</label>
                  <select style={s.input} value={form.preferred_language || "es"} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Correo Electrónico</label>
                <input style={s.input} type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@empresa.com" />
              </div>

              {mode === "create" && (
                <div style={s.field}>
                  <label style={s.label}>Contraseña *</label>
                  <input style={s.input} type="password" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" required minLength={8} />
                </div>
              )}
            </>
          )}

          {mode === "reset-password" && (
            <>
              <div style={s.field}>
                <label style={s.label}>Nueva Contraseña *</label>
                <input style={s.input} type="password" value={form.new_password || ""} onChange={(e) => setForm({ ...form, new_password: e.target.value })} placeholder="Mínimo 8 caracteres" required minLength={8} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Confirmar Contraseña *</label>
                <input style={s.input} type="password" value={form.confirm_password || ""} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} placeholder="Repite la contraseña" required minLength={8} />
              </div>
            </>
          )}

          {error && <p style={s.error}>{error}</p>}

          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" style={s.submitBtn} disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  modal: { backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  title: { fontSize: "1.1rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex", alignItems: "center" },
  form: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.375rem" },
  label: { fontSize: "0.825rem", fontWeight: "600", color: "var(--color-text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" },
  labelHint: { fontSize: "0.75rem", fontWeight: "400", color: "var(--color-text-secondary)" },
  input: { padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  rolesBox: { border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-bg)", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "200px", overflowY: "auto" },
  roleGroup: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  roleGroupLabel: { fontSize: "0.7rem", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
  roleGrid: { display: "flex", flexWrap: "wrap", gap: "0.375rem" },
  roleChip: { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.35rem 0.625rem", borderRadius: "99px", border: "1px solid var(--color-border)", background: "none", cursor: "pointer", fontSize: "0.775rem", color: "var(--color-text-secondary)", whiteSpace: "nowrap" },
  roleChipActive: { backgroundColor: "rgba(10,110,189,0.1)", borderColor: "var(--color-primary)", color: "var(--color-primary)", fontWeight: "600" },
  error: { color: "var(--color-stopped)", fontSize: "0.825rem", padding: "0.5rem", backgroundColor: "rgba(220,38,38,0.08)", borderRadius: "var(--radius-sm)" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" },
  cancelBtn: { padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-secondary)" },
  submitBtn: { padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", border: "none", backgroundColor: "var(--color-primary)", color: "#ffffff", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
};