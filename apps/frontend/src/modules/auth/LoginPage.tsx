import { useState } from "react";
import { useAuth } from "./useAuth";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(employeeId, password);
  };

  return (
    <div style={styles.container}>
      {/* Fondo con logo */}
      <img src="/logoSSIclaro.png" style={styles.backgroundLogo} />

      <div style={styles.card}>
        {/* Logo principal */}
         {/*<img src="/logoSSIclaro.png" style={styles.logo} />*/}

        <h1 style={styles.title}>SSI Platform</h1>
        <p style={styles.subtitle}>System access</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Employee Number</label>
            <input
              style={styles.input}
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Ej. 840934"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Authenticating..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--color-bg)",
    position: "relative",
    overflow: "hidden",
  },

  /* 🔽 Logo grande de fondo */
  backgroundLogo: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "70%",
    opacity: 0.04,
    pointerEvents: "none",
  },

  card: {
    position: "relative",
    zIndex: 1,
    backgroundColor: "var(--color-surface)",
    padding: "2.5rem",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
    width: "100%",
    maxWidth: "400px",
    border: "1px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  /* 🔽 Logo pequeño arriba */
  logo: {
    width: "120px",
    marginBottom: "1rem",
    opacity: 0.9,
  },

  title: {
    color: "var(--color-primary)",
    fontSize: "1.6rem",
    fontWeight: "bold",
    marginBottom: "0.25rem",
    textAlign: "center",
  },

  subtitle: {
    color: "var(--color-text-secondary)",
    textAlign: "center",
    marginBottom: "2rem",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    width: "100%",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },

  label: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "var(--color-text-primary)",
  },

  input: {
    padding: "0.7rem 0.9rem",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    fontSize: "1rem",
    color: "var(--color-text-primary)",
    backgroundColor: "var(--color-bg)",
    outline: "none",
  },

  error: {
    color: "var(--color-stopped)",
    fontSize: "0.875rem",
    textAlign: "center",
  },

  button: {
    padding: "0.8rem",
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
    border: "none",
    borderRadius: "var(--radius-md)",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "0.5rem",
  },
};