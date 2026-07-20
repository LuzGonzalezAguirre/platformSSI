import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Play } from "lucide-react";
import {
  useIncomingInspectionKPIs, useIncomingInspectionDetail,
  useSLAConfig, useUpdateSLAConfig,
} from "./hooks/useIncomingInspection";
import type { IncomingInspectionFilters } from "./types";

// Debugging temporal (ver PR de investigación de History en cero): oculta
// todos los filtros salvo el rango de fechas, sin borrar su código — cambiar
// a `true` para restaurarlos tal cual estaban.
const SHOW_EXTRA_FILTERS = false;

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg, 10px)",
  padding: "1.25rem",
};

const cardTitle: React.CSSProperties = {
  fontSize: "0.8125rem", fontWeight: 700,
  color: "var(--color-text-primary)", marginBottom: "0.875rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem", fontSize: "0.75rem",
  borderRadius: "var(--radius-sm, 6px)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "0.35rem 0.5rem", fontWeight: 700,
  color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", color: "var(--color-text-primary)",
  borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
};

function KPITile({ label, value, sub, color, accent }: {
  label: string; value: string; sub?: string; color?: string; accent?: string;
}) {
  return (
    <div style={{ ...card, borderTop: `3px solid ${accent ?? "#3b82f6"}`, padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: "0.25rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: color ?? "var(--color-text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", marginTop: "0.375rem" }}>{sub}</div>}
    </div>
  );
}

function Donut({ pct, color, size = 100 }: { pct: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={9} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={color}>
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000, padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg, 10px)", padding: "1.25rem",
          maxWidth: 420, width: "100%", boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-text-primary)" }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "1.1rem", color: "var(--color-text-secondary)" }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SLAConfigModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSLAConfig();
  const updateSLA = useUpdateSLAConfig();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (data) setValue(String(data.threshold_hours));
  }, [data]);

  const handleSave = async () => {
    setMsg(null);
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 500) {
      setMsg({ text: t("incomingInspection.slaConfig.invalid"), ok: false });
      return;
    }
    try {
      await updateSLA.mutateAsync(parsed);
      setMsg({ text: t("incomingInspection.slaConfig.saved"), ok: true });
    } catch (err: any) {
      const forbidden = err?.response?.status === 403;
      setMsg({ text: forbidden ? t("incomingInspection.slaConfig.forbidden") : t("incomingInspection.detail.error"), ok: false });
    }
  };

  return (
    <Modal title={t("incomingInspection.slaConfig.modalTitle")} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
          {t("incomingInspection.slaConfig.thresholdHours")}
        </label>
        <input
          type="number" min={1} max={500} disabled={isLoading}
          value={value} onChange={e => setValue(e.target.value)}
          style={{ ...inputStyle, width: "100%" }}
        />
        {msg && (
          <span style={{ fontSize: "0.8rem", color: msg.ok ? "#10b981" : "#ef4444" }}>{msg.text}</span>
        )}
        <button
          onClick={handleSave}
          disabled={updateSLA.isPending}
          style={{
            ...inputStyle, fontWeight: 600, cursor: "pointer", alignSelf: "flex-end",
            background: "#3b82f6", color: "#fff", border: "none", padding: "0.4rem 1rem",
          }}
        >
          {updateSLA.isPending ? t("incomingInspection.slaConfig.saving") : t("incomingInspection.slaConfig.save")}
        </button>
      </div>
    </Modal>
  );
}

const todayStr = (): string => new Date().toISOString().slice(0, 10);
const DEFAULT_FROM = "2026-01-01";

export default function IncomingInspectionPage() {
  const { t } = useTranslation();

  const [filters, setFilters] = useState<IncomingInspectionFilters>({
    date_from: DEFAULT_FROM,
    date_to: todayStr(),
  });
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [showSLAModal, setShowSLAModal] = useState(false);

  const {
    data: kpis, isFetching: kpisFetching, error: kpisError, refetch: refetchKPIs,
  } = useIncomingInspectionKPIs(filters);
  const {
    data: detail, isFetching: detailFetching, refetch: refetchDetail,
  } = useIncomingInspectionDetail(filters, page, pageSize, "-change_date");

  const hasLoadedOnce = kpis !== undefined;

  const setFilter = (patch: Partial<IncomingInspectionFilters>) => {
    setFilters(f => ({ ...f, ...patch }));
    setPage(1);
  };

  // Botón "Cargar" — el único disparador de fetch (enabled:false en ambos
  // hooks). Nada de setState aquí: `filters`/`page` ya están al día por los
  // onChange previos, así que refetch() usa el queryFn del render actual —
  // sin cierres viejos.
  const handleLoad = () => {
    refetchKPIs();
    refetchDetail();
  };

  // Paginación: page cambia vía setPage en los botones ← →; el efecto corre
  // DESPUÉS del re-render con el page nuevo, así que refetchDetail() nunca
  // usa un page desactualizado. Se salta el primer mount (enabled:false ya
  // cubre eso) para no disparar un fetch antes de presionar "Cargar".
  const didMountPageEffect = useRef(false);
  useEffect(() => {
    if (!didMountPageEffect.current) { didMountPageEffect.current = true; return; }
    if (hasLoadedOnce) refetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const acceptance = kpis?.acceptance_rate;
  const sla = kpis?.sla_compliance;
  const slaColor = sla && sla.compliance_rate >= 90 ? "#10b981" : sla && sla.compliance_rate >= 75 ? "#f59e0b" : "#ef4444";
  const acceptColor = acceptance && acceptance.acceptance_rate >= 95 ? "#10b981" : acceptance && acceptance.acceptance_rate >= 85 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <style>{`@keyframes iiSpin { to { transform: rotate(360deg); } }`}</style>

      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
          {t("incomingInspection.title")}
        </h1>
        <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", margin: "0.2rem 0 0" }}>
          {t("incomingInspection.subtitle")}
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <input type="date" style={inputStyle} value={filters.date_from ?? ""} max={filters.date_to}
          onChange={e => setFilter({ date_from: e.target.value })} />
        <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>→</span>
        <input type="date" style={inputStyle} value={filters.date_to ?? ""} max={todayStr()}
          onChange={e => setFilter({ date_to: e.target.value })} />

        {SHOW_EXTRA_FILTERS && (
          <>
            <input type="text" placeholder={t("incomingInspection.filters.partNo")} style={inputStyle}
              value={filters.part_no ?? ""} onChange={e => setFilter({ part_no: e.target.value || undefined })} />
            <select style={inputStyle} value={filters.operation_no ?? ""}
              onChange={e => setFilter({ operation_no: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">{t("incomingInspection.filters.allOperations")}</option>
              <option value={10}>10</option>
              <option value={11}>11</option>
              <option value={20}>20</option>
            </select>
            <input type="text" placeholder={t("incomingInspection.filters.location")} style={inputStyle}
              value={filters.location ?? ""} onChange={e => setFilter({ location: e.target.value || undefined })} />
            <input type="text" placeholder={t("incomingInspection.filters.containerStatus")} style={inputStyle}
              value={filters.container_status ?? ""} onChange={e => setFilter({ container_status: e.target.value || undefined })} />
            <input type="text" placeholder={t("incomingInspection.filters.defectType")} style={inputStyle}
              value={filters.defect_type ?? ""} onChange={e => setFilter({ defect_type: e.target.value || undefined })} />
            <select style={inputStyle} value={filters.sla_status ?? ""}
              onChange={e => setFilter({ sla_status: (e.target.value || undefined) as "on_time" | "late" | undefined })}>
              <option value="">{t("incomingInspection.filters.allSlaStatus")}</option>
              <option value="on_time">{t("incomingInspection.filters.onTime")}</option>
              <option value="late">{t("incomingInspection.filters.late")}</option>
            </select>
          </>
        )}

        <button
          type="button"
          onClick={handleLoad}
          disabled={kpisFetching || detailFetching}
          style={{
            ...inputStyle, display: "flex", alignItems: "center", gap: "0.375rem",
            fontWeight: 600, cursor: (kpisFetching || detailFetching) ? "default" : "pointer",
            background: "#3b82f6", color: "#fff", border: "none", padding: "0.4rem 0.9rem",
            opacity: (kpisFetching || detailFetching) ? 0.7 : 1,
          }}
        >
          {(kpisFetching || detailFetching)
            ? <RefreshCw size={14} style={{ animation: "iiSpin 1s linear infinite" }} />
            : <Play size={14} />}
          <span>{t("incomingInspection.filters.load")}</span>
        </button>
      </div>

      {kpisError && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "8px", color: "#ef4444", fontSize: "0.85rem" }}>
          {t("incomingInspection.detail.error")}
        </div>
      )}

      {!hasLoadedOnce && !kpisFetching && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
          {t("incomingInspection.idle")}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        <div style={card}>
          <div style={cardTitle}>{t("incomingInspection.kpis.operationCounts")}</div>
          {kpisFetching ? (
            <RefreshCw size={16} style={{ animation: "iiSpin 1s linear infinite", color: "var(--color-text-secondary)" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {(kpis?.operation_counts ?? []).map(oc => (
                <div key={oc.operation_no} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Op {oc.operation_no}</span>
                  <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{oc.container_count}</span>
                </div>
              ))}
              {(kpis?.operation_counts ?? []).length === 0 && (
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("incomingInspection.detail.noData")}</span>
              )}
            </div>
          )}
        </div>

        <KPITile
          label={t("incomingInspection.kpis.lotsInspected")}
          value={kpisFetching ? "…" : String(kpis?.lots_inspected.total ?? 0)}
          accent="#3b82f6"
        />

        <div style={{ ...card, display: "flex", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={cardTitle}>{t("incomingInspection.kpis.acceptanceRate")}</div>
            {kpisFetching ? (
              <RefreshCw size={16} style={{ animation: "iiSpin 1s linear infinite", color: "var(--color-text-secondary)" }} />
            ) : acceptance && (
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                {t("incomingInspection.kpis.accepted")}: {acceptance.accepted} · {t("incomingInspection.kpis.rejected")}: {acceptance.rejected}
              </div>
            )}
          </div>
          {!kpisFetching && acceptance && <Donut pct={acceptance.acceptance_rate} color={acceptColor} />}
        </div>

        <div style={{ ...card, display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={cardTitle}>{t("incomingInspection.kpis.slaCompliance")}</div>
              <button
                onClick={() => setShowSLAModal(true)}
                style={{ ...inputStyle, fontSize: "0.68rem", cursor: "pointer", padding: "0.2rem 0.5rem" }}
              >
                {t("incomingInspection.slaConfig.button")}
              </button>
            </div>
            {kpisFetching ? (
              <RefreshCw size={16} style={{ animation: "iiSpin 1s linear infinite", color: "var(--color-text-secondary)" }} />
            ) : sla && (
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                {t("incomingInspection.kpis.onTime")}: {sla.on_time} · {t("incomingInspection.kpis.late")}: {sla.late}
                <br />
                {t("incomingInspection.kpis.threshold")}: {sla.threshold_hours}h
              </div>
            )}
          </div>
          {!kpisFetching && sla && <Donut pct={sla.compliance_rate} color={slaColor} />}
        </div>
      </div>

      {/* ── Detail table ── */}
      <div style={card}>
        <div style={cardTitle}>{t("incomingInspection.detail.title")}</div>
        {detailFetching ? (
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
            <RefreshCw size={14} style={{ animation: "iiSpin 1s linear infinite" }} />
            {t("incomingInspection.detail.loading")}
          </span>
        ) : (detail?.results.length ?? 0) === 0 ? (
          <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("incomingInspection.detail.noData")}</span>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.serialNo")}</th>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.partNo")}</th>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.operation")}</th>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.changeDate")}</th>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.location")}</th>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.status")}</th>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.defectType")}</th>
                    <th style={thStyle}>{t("incomingInspection.detail.columns.changeBy")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail?.results.map(row => (
                    <tr key={row.id}>
                      <td style={tdStyle}>{row.serial_no}</td>
                      <td style={tdStyle}>{row.part_no}</td>
                      <td style={tdStyle}>{row.operation_no}</td>
                      <td style={tdStyle}>{new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(row.change_date))}</td>
                      <td style={tdStyle}>{row.location}</td>
                      <td style={tdStyle}>{row.container_status}</td>
                      <td style={tdStyle}>{row.defect_type}</td>
                      <td style={tdStyle}>{row.change_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button style={inputStyle} disabled={!detail?.previous} onClick={() => setPage(p => p - 1)}>←</button>
              <button style={inputStyle} disabled={!detail?.next} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          </>
        )}
      </div>

      {showSLAModal && <SLAConfigModal onClose={() => setShowSLAModal(false)} />}
    </div>
  );
}
