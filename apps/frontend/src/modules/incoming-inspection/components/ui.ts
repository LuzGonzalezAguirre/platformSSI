import type React from "react";

export const COLORS = {
  accent: "#3b82f6",
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
  muted: "#94a3b8",
};

export const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  padding: "1rem",
};

export const cardTitle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-text-secondary)",
  marginBottom: "0.75rem",
};

export const bigNumber: React.CSSProperties = {
  fontSize: "1.6rem",
  fontWeight: 800,
  color: "var(--color-text-primary)",
  lineHeight: 1.1,
};

export const AXIS = "var(--color-border)";
export const LABEL = "var(--color-text-secondary)";

export function slaColor(pct: number): string {
  return pct >= 90 ? COLORS.good : pct >= 75 ? COLORS.warn : COLORS.bad;
}

export function acceptanceColor(pct: number): string {
  return pct >= 95 ? COLORS.good : pct >= 85 ? COLORS.warn : COLORS.bad;
}