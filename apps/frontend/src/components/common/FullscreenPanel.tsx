import { useTranslation } from "react-i18next";

interface Props {
  title: string;
  subtitle?: string;
  onExit: () => void;
  children: React.ReactNode;
}

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg, 10px)",
  padding: "1.25rem",
};

function toggleStyle(): React.CSSProperties {
  return {
    padding: "0.35rem 0.85rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    borderRadius: "var(--radius-sm, 6px)",
    cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-text-secondary)",
    whiteSpace: "nowrap",
  };
}

/**
 * Overlay de pantalla completa para una sola grafica/panel. Mismo estilo
 * visual que el fullscreen inline de ScrapRatePage.tsx (position: fixed,
 * inset 0, zIndex 2000, Esc para salir via useFullscreen). El cierre por
 * Esc lo maneja useFullscreen -- este componente solo pinta el overlay.
 */
export default function FullscreenPanel({ title, subtitle, onExit, children }: Props) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "var(--color-bg)",
        padding: "1.5rem 2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
            {subtitle}
          </div>
        )}
        <button style={{ ...toggleStyle(), marginLeft: "auto" }} onClick={onExit}>
          {t("scrapRate.exitFullscreen")}
        </button>
      </div>
      <div style={{ ...card, flex: 1 }}>{children}</div>
    </div>
  );
}