import { CalendarClock, Clock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PmpEvent, PM, PmStatus, normalizeStatus, buColor, buKey } from "./types";

interface Props {
  dateLabel: string;
  requests:  PmpEvent[];
}

const STATUS_STYLES: Record<PmStatus, { bg: string; color: string; bar: string }> = {
  "complete":  { bg: PM.successSoft,    color: PM.success,                 bar: PM.success },
  "hold":      { bg: PM.holdSoft,       color: PM.hold,                    bar: PM.hold },
  "open":      { bg: "var(--color-bg)", color: "var(--color-text-secondary)", bar: "var(--color-border)" },
  "cancelled": { bg: "var(--color-bg)", color: "var(--color-text-secondary)", bar: "var(--color-border)" },
};

const miniTile: React.CSSProperties = {
  borderRadius: "var(--radius-sm)",
  background:   "var(--color-bg)",
  padding:      "0.5rem 0.75rem",
};

const miniLabel: React.CSSProperties = {
  fontSize:      "0.625rem",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color:         "var(--color-text-secondary)",
  display:       "block",
};

const miniValue: React.CSSProperties = {
  fontFamily:         PM.mono,
  fontSize:           "0.875rem",
  fontWeight:         600,
  color:              "var(--color-text-primary)",
  fontVariantNumeric: "tabular-nums",
};

export default function PmpDetailPanel({ dateLabel, requests }: Props) {
  const { t } = useTranslation();

  const active   = requests.filter((r) => normalizeStatus(r.status) !== "cancelled");
  const hours    = active.reduce((sum, r) => sum + (r.scheduled_hours || 0), 0);
  const complete = active.filter((r) => normalizeStatus(r.status) === "complete").length;

  return (
    <aside style={{
      display:      "flex",
      flexDirection: "column",
      maxHeight:    "46rem",
      borderRadius: "var(--radius-md)",
      border:       "1px solid var(--color-border)",
      background:   "var(--color-surface)",
      overflow:     "hidden",
    }}>
      <header style={{
        display:       "flex",
        flexDirection: "column",
        gap:           "0.75rem",
        borderBottom:  "1px solid var(--color-border)",
        padding:       "0.75rem 1rem",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {t("pmp.panel.title")}
            </h2>
            <p style={{
              margin:     0,
              display:    "flex",
              alignItems: "center",
              gap:        "0.4rem",
              fontSize:   "0.75rem",
              color:      "var(--color-text-secondary)",
              textTransform: "capitalize",
            }}>
              <CalendarClock size={14} />
              {dateLabel}
            </p>
          </div>
          <span style={{
            borderRadius:       "var(--radius-sm)",
            background:         "var(--color-bg)",
            padding:            "0.25rem 0.5rem",
            fontFamily:         PM.mono,
            fontSize:           "0.75rem",
            fontWeight:         600,
            color:              "var(--color-text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {requests.length}
          </span>
        </div>

        {active.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div style={miniTile}>
              <span style={miniLabel}>{t("pmp.panel.estHours")}</span>
              <span style={miniValue}>{hours.toFixed(1)}</span>
            </div>
            <div style={miniTile}>
              <span style={miniLabel}>{t("pmp.panel.closed")}</span>
              <span style={miniValue}>{complete}/{active.length}</span>
            </div>
          </div>
        )}
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
        {requests.length === 0 ? (
          <p style={{
            padding:   "2rem 0.5rem",
            textAlign: "center",
            fontSize:  "0.875rem",
            color:     "var(--color-text-secondary)",
          }}>
            {t("pmp.panel.noEvents")}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {requests.map((r) => {
              const st = normalizeStatus(r.status);
              const s  = STATUS_STYLES[st];
              return (
                <li key={r.work_request_no}>
                  <div style={{
                    position:      "relative",
                    display:       "flex",
                    flexDirection: "column",
                    gap:           "0.375rem",
                    overflow:      "hidden",
                    borderRadius:  "var(--radius-sm)",
                    border:        "1px solid var(--color-border)",
                    background:    "var(--color-surface)",
                    padding:       "0.625rem 0.75rem 0.625rem 1rem",
                    opacity:       st === "cancelled" ? 0.55 : 1,
                  }}>
                    <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 4, background: s.bar }} />

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{
                        fontFamily:         PM.mono,
                        fontSize:           "0.875rem",
                        fontWeight:         600,
                        color:              "var(--color-text-primary)",
                        fontVariantNumeric: "tabular-nums",
                        textDecoration:     st === "cancelled" ? "line-through" : "none",
                      }}>
                        {r.work_request_no}
                      </span>
                      <span style={{
                        borderRadius:  4,
                        padding:       "0.1rem 0.35rem",
                        fontSize:      "0.625rem",
                        fontWeight:    700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        background:    s.bg,
                        color:         s.color,
                        whiteSpace:    "nowrap",
                      }}>
                        {t(`pmp.status.${st}`)}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.35, color: "var(--color-text-primary)" }}>
                      {r.equipment_description || r.description}
                    </p>

                    <div style={{
                      display:    "flex",
                      flexWrap:   "wrap",
                      alignItems: "center",
                      columnGap:  "0.75rem",
                      rowGap:     "0.25rem",
                      fontSize:   "0.6875rem",
                      color:      "var(--color-text-secondary)",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <User size={12} />{r.assigned_to}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock size={12} />{(r.scheduled_hours || 0).toFixed(1)} h
                      </span>
                      <span style={{
                        borderRadius: 4,
                        padding:      "0.1rem 0.35rem",
                        fontWeight:   500,
                        background:   "var(--color-bg)",
                        color:        buColor(r.bu),
                      }}>
                        {t(`pmp.bu.${buKey(r.bu)}`, { defaultValue: r.bu })}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}