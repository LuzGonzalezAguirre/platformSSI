import { DowntimeReason } from "./types";

interface Props {
  reasons:       DowntimeReason[];
  grandTotal:    number;
  lang:          string;
  onViewLogs:    (reason: string) => void;  // renombrado para claridad
}

export default function DowntimeReasons({ reasons, grandTotal, lang, onViewLogs }: Props) {
  const maxPct = reasons.length > 0 ? Math.max(...reasons.map((r) => r.percentage)) : 100;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={sectionTitle}>
          {lang === "es" ? "Paros por Razón" : "Downtime by Reason"}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
          {lang === "es" ? "Total:" : "Total:"}{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>{grandTotal.toFixed(2)} hrs</strong>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {reasons.map((r) => (
          <div key={r.reason}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem", marginBottom: "0.3rem" }}>
              <span style={{ fontWeight: 600, color: "var(--color-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "0.75rem" }}>
                {r.reason}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                <span style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem" }}>
                  {r.total_hours.toFixed(2)} hrs · {r.total_events} {lang === "es" ? "eventos" : "events"}
                </span>
                <strong style={{ color: r.percentage > 30 ? "#ef4444" : r.percentage > 15 ? "#f59e0b" : "#10b981", minWidth: 42, textAlign: "right" }}>
                  {r.percentage.toFixed(1)}%
                </strong>
                {/* Botón View Logs */}
                <button
                  onClick={() => onViewLogs(r.reason)}
                  style={{
                    padding: "0.2rem 0.625rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg)",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  View Logs
                </button>
              </div>
            </div>
            <div style={{ height: 10, background: "var(--color-border)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(r.percentage / maxPct) * 100}%`,
                background: r.percentage > 30 ? "#ef4444" : r.percentage > 15 ? "#f59e0b" : "#3b82f6",
                borderRadius: 5,
                transition: "width 0.5s",
              }} />
            </div>
          </div>
        ))}
        {reasons.length === 0 && (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
            {lang === "es" ? "Sin datos en el rango seleccionado" : "No data for selected range"}
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)", padding: "1.25rem",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0,
};