import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Play, MessageSquare, X } from "lucide-react";
import {
  useIncomingInspectionKPIs, useIncomingInspectionDetail, useRejectedLots,
  useSLAConfig, useUpdateSLAConfig, useRejectionComments, useCreateRejectionComment,
  useUserNames,
} from "./hooks/useIncomingInspection";
import type { IncomingInspectionFilters, IncomingContainerHistoryRow } from "./types";
import DashboardTab from "./components/DashboardTab";
import PendingTab from "./components/PendingTab";

const MAX_ROWS = 3000; // debe coincidir con MAX_PAGE_SIZE del backend

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
  whiteSpace: "nowrap", position: "sticky", top: 0,
  background: "var(--color-surface)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem", color: "var(--color-text-primary)",
  borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap",
};

// ── Date range presets ──────────────────────────────────────────────────────

type DateRange = { from: string; to: string };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };

function startOfWeek(d: Date) {
  const c = new Date(d);
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(c, diff);
}

const DATE_PRESETS: { key: string; label: string; compute: () => DateRange }[] = [
  { key: "today", label: "Today", compute: () => { const t = new Date(); return { from: fmt(t), to: fmt(t) }; } },
  { key: "yesterday", label: "Yesterday", compute: () => { const y = addDays(new Date(), -1); return { from: fmt(y), to: fmt(y) }; } },
  { key: "current_week", label: "Current Week", compute: () => { const s = startOfWeek(new Date()); return { from: fmt(s), to: fmt(addDays(s, 6)) }; } },
  { key: "next_week", label: "Next Week", compute: () => { const s = addDays(startOfWeek(new Date()), 7); return { from: fmt(s), to: fmt(addDays(s, 6)) }; } },
  { key: "previous_week", label: "Previous Week", compute: () => { const s = addDays(startOfWeek(new Date()), -7); return { from: fmt(s), to: fmt(addDays(s, 6)) }; } },
  { key: "previous_week_monday", label: "Previous Week Monday", compute: () => { const s = addDays(startOfWeek(new Date()), -7); return { from: fmt(s), to: fmt(s) }; } },
  { key: "last_7_days", label: "Last 7 Days", compute: () => { const t = new Date(); return { from: fmt(addDays(t, -6)), to: fmt(t) }; } },
  { key: "month_to_date", label: "Month To Date", compute: () => { const t = new Date(); return { from: fmt(new Date(t.getFullYear(), t.getMonth(), 1)), to: fmt(t) }; } },
  { key: "current_month", label: "Current Month", compute: () => { const t = new Date(); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0); return { from: fmt(new Date(t.getFullYear(), t.getMonth(), 1)), to: fmt(last) }; } },
  { key: "previous_month", label: "Previous Month", compute: () => { const t = new Date(); const first = new Date(t.getFullYear(), t.getMonth() - 1, 1); const last = new Date(t.getFullYear(), t.getMonth(), 0); return { from: fmt(first), to: fmt(last) }; } },
  { key: "next_30_days", label: "Next 30 Days", compute: () => { const t = new Date(); return { from: fmt(t), to: fmt(addDays(t, 30)) }; } },
  { key: "last_30_days", label: "Last 30 Days", compute: () => { const t = new Date(); return { from: fmt(addDays(t, -29)), to: fmt(t) }; } },
  { key: "last_60_days", label: "Last 60 Days", compute: () => { const t = new Date(); return { from: fmt(addDays(t, -59)), to: fmt(t) }; } },
  { key: "last_90_days", label: "Last 90 Days", compute: () => { const t = new Date(); return { from: fmt(addDays(t, -89)), to: fmt(t) }; } },
  { key: "year_to_date", label: "Year To Date", compute: () => { const t = new Date(); return { from: fmt(new Date(t.getFullYear(), 0, 1)), to: fmt(t) }; } },
  { key: "current_year", label: "Current Year", compute: () => { const t = new Date(); return { from: fmt(new Date(t.getFullYear(), 0, 1)), to: fmt(new Date(t.getFullYear(), 11, 31)) }; } },
];

function DateRangeDropdown({ filters, onChange }: {
  filters: IncomingInspectionFilters;
  onChange: (patch: Partial<IncomingInspectionFilters>) => void;
}) {
  const [preset, setPreset] = useState("custom");

  const handlePresetChange = (key: string) => {
    setPreset(key);
    if (key === "custom") return;
    const found = DATE_PRESETS.find(p => p.key === key);
    if (found) {
      const range = found.compute();
      onChange({ date_from: range.from, date_to: range.to });
    }
  };

  return (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
      <select style={inputStyle} value={preset} onChange={e => handlePresetChange(e.target.value)}>
        <option value="custom">(select custom range)</option>
        {DATE_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {preset === "custom" && (
        <>
          <input type="date" style={inputStyle} value={filters.date_from ?? ""} max={filters.date_to}
            onChange={e => onChange({ date_from: e.target.value })} />
          <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>→</span>
          <input type="date" style={inputStyle} value={filters.date_to ?? ""} max={fmt(new Date())}
            onChange={e => onChange({ date_to: e.target.value })} />
        </>
      )}
    </div>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────

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
          maxWidth: 520, width: "100%", maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-text-primary)" }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-secondary)" }}
          >
            <X size={18} />
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

function CommentsModal({ serialNo, onClose }: { serialNo: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: comments, isFetching } = useRejectionComments(serialNo);
  const createComment = useCreateRejectionComment(serialNo);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!text.trim()) return;
    try {
      await createComment.mutateAsync(text.trim());
      setText("");
    } catch {
      setError(t("incomingInspection.detail.error"));
    }
  };

  return (
    <Modal title={`${t("incomingInspection.rejected.comments")} — ${serialNo}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 280, overflowY: "auto" }}>
          {isFetching ? (
            <RefreshCw size={16} style={{ animation: "iiSpin 1s linear infinite", color: "var(--color-text-secondary)" }} />
          ) : (comments ?? []).length === 0 ? (
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
              {t("incomingInspection.rejected.noComments")}
            </span>
          ) : (
            comments!.map(c => (
              <div key={c.id} style={{ ...card, padding: "0.6rem 0.75rem" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>{c.comment}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", marginTop: "0.3rem" }}>
                  {c.created_by_name} · {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(c.created_at))}
                </div>
              </div>
            ))
          )}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t("incomingInspection.rejected.commentPlaceholder")}
          rows={3}
          style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: "inherit" }}
        />
        {error && <span style={{ fontSize: "0.8rem", color: "#ef4444" }}>{error}</span>}
        <button
          onClick={handleSubmit}
          disabled={createComment.isPending || !text.trim()}
          style={{
            ...inputStyle, fontWeight: 600, cursor: "pointer", alignSelf: "flex-end",
            background: "#3b82f6", color: "#fff", border: "none", padding: "0.4rem 1rem",
            opacity: (createComment.isPending || !text.trim()) ? 0.6 : 1,
          }}
        >
          {createComment.isPending ? t("incomingInspection.rejected.saving") : t("incomingInspection.rejected.addComment")}
        </button>
      </div>
    </Modal>
  );
}

// ── Detail table (shared shape for both tabs), con scroll interno ──────────

function HistoryTable({ rows, userNames = {}, onRowClick }: {
  rows: IncomingContainerHistoryRow[];
  userNames?: Record<string, string>;
  onRowClick?: (row: IncomingContainerHistoryRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ maxHeight: 520, overflowY: "auto", overflowX: "auto" }}>
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
            {onRowClick && <th style={thStyle}></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td style={tdStyle}>{row.serial_no}</td>
              <td style={tdStyle}>{row.part_no}</td>
              <td style={tdStyle}>{row.operation_no}</td>
              <td style={tdStyle}>{new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(row.change_date))}</td>
              <td style={tdStyle}>{row.location}</td>
              <td style={tdStyle}>{row.container_status}</td>
              <td style={tdStyle}>{row.defect_type}</td>
              <td style={tdStyle}>{row.change_by ? (userNames[row.change_by] ?? row.change_by) : ""}</td>
              {onRowClick && (
                <td style={tdStyle}>
                  <button
                    onClick={() => onRowClick(row)}
                    style={{ ...inputStyle, display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", padding: "0.25rem 0.5rem" }}
                  >
                    <MessageSquare size={12} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const todayStr = (): string => fmt(new Date());
const DEFAULT_FROM = "2026-01-01";

export default function IncomingInspectionPage() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"dashboard" | "pending" | "summary" | "rejected">("dashboard");
  const [filters, setFilters] = useState<IncomingInspectionFilters>({
    date_from: DEFAULT_FROM,
    date_to: todayStr(),
  });
  const [showSLAModal, setShowSLAModal] = useState(false);
  const [activeCommentSerial, setActiveCommentSerial] = useState<string | null>(null);

  const {
    data: kpis, isFetching: kpisFetching, error: kpisError, refetch: refetchKPIs,
  } = useIncomingInspectionKPIs(filters);
  const {
    data: detail, isFetching: detailFetching, refetch: refetchDetail,
  } = useIncomingInspectionDetail(filters, 1, MAX_ROWS, "-change_date");
  const {
    data: rejected, isFetching: rejectedFetching, refetch: refetchRejected,
  } = useRejectedLots(filters, 1, MAX_ROWS);

  const hasLoadedOnce = kpis !== undefined || rejected !== undefined;

  const changeByNosSummary = (detail?.results ?? [])
    .map(r => r.change_by)
    .filter((v): v is string => !!v)
    .map(Number)
    .filter(n => !Number.isNaN(n));
  const { data: userNamesSummary } = useUserNames(changeByNosSummary);

  const changeByNosRejected = (rejected?.results ?? [])
    .map(r => r.change_by)
    .filter((v): v is string => !!v)
    .map(Number)
    .filter(n => !Number.isNaN(n));
  const { data: userNamesRejected } = useUserNames(changeByNosRejected);

  const setFilter = (patch: Partial<IncomingInspectionFilters>) => {
    setFilters(f => ({ ...f, ...patch }));
  };

  const handleLoad = () => {
    if (activeTab === "summary") {
      refetchKPIs();
      refetchDetail();
    } else {
      refetchRejected();
    }
  };

  const isLoading = activeTab === "summary" ? (kpisFetching || detailFetching) : rejectedFetching;

  const acceptance = kpis?.acceptance_rate;
  const sla = kpis?.sla_compliance;
  const slaColor = sla && sla.compliance_rate >= 90 ? "#10b981" : sla && sla.compliance_rate >= 75 ? "#f59e0b" : "#ef4444";
  const acceptColor = acceptance && acceptance.acceptance_rate >= 95 ? "#10b981" : acceptance && acceptance.acceptance_rate >= 85 ? "#f59e0b" : "#ef4444";

  const tabStyle = (tab: "dashboard" | "pending" | "summary" | "rejected"): React.CSSProperties => ({
    padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
    border: "none", background: "transparent",
    color: activeTab === tab ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
  });

  const detailTruncated = (detail?.count ?? 0) > MAX_ROWS;
  const rejectedTruncated = (rejected?.count ?? 0) > MAX_ROWS;

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

      {/* ── Tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
        <button style={tabStyle("dashboard")} onClick={() => setActiveTab("dashboard")}>
  {t("incomingInspection.tabs.dashboard")}
</button>
<button style={tabStyle("pending")} onClick={() => setActiveTab("pending")}>
  {t("incomingInspection.tabs.pending")}
</button>
        <button style={tabStyle("summary")} onClick={() => setActiveTab("summary")}>
          {t("incomingInspection.tabs.summary")}
        </button>
        <button style={tabStyle("rejected")} onClick={() => setActiveTab("rejected")}>
          {t("incomingInspection.tabs.rejected")}
        </button>
      </div>

      {/* ── Filter bar: fechas + operación (10/11/20) + status (OK/Hold) ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <DateRangeDropdown filters={filters} onChange={setFilter} />

        <select style={inputStyle} value={filters.operation_no ?? ""}
          onChange={e => setFilter({ operation_no: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">{t("incomingInspection.filters.allOperations")}</option>
          <option value={10}>10</option>
          <option value={11}>11</option>
          <option value={20}>20</option>
        </select>

        {activeTab === "summary" && (
          <select style={inputStyle} value={filters.container_status ?? ""}
            onChange={e => setFilter({ container_status: e.target.value || undefined })}>
            <option value="">{t("incomingInspection.filters.allStatus")}</option>
            <option value="OK">OK</option>
            <option value="Hold">Hold</option>
          </select>
        )}

        <button
          type="button"
          onClick={handleLoad}
          disabled={isLoading}
          style={{
            ...inputStyle, display: "flex", alignItems: "center", gap: "0.375rem",
            fontWeight: 600, cursor: isLoading ? "default" : "pointer",
            background: "#3b82f6", color: "#fff", border: "none", padding: "0.4rem 0.9rem",
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading
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

      {!hasLoadedOnce && !isLoading && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
          {t("incomingInspection.idle")}
        </div>
      )}

      {activeTab === "dashboard" && <DashboardTab filters={filters} />}
      {activeTab === "pending" && <PendingTab filters={filters} />}

      {/* ── SUMMARY TAB ── */}
      {activeTab === "summary" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
            <div style={card}>
              <div style={cardTitle}>{t("incomingInspection.kpis.operationCounts")}</div>
              {kpisFetching ? (
                <RefreshCw size={16} style={{ animation: "iiSpin 1s linear infinite", color: "var(--color-text-secondary)" }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {(kpis?.operation_counts ?? []).map(oc => (
                    <div key={oc.operation_key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>{oc.operation_name}</span>
                      <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{oc.lot_count}</span>
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

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
              <div style={{ ...cardTitle, marginBottom: 0 }}>
                {t("incomingInspection.detail.title")}
                {detail && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> </span>}
              </div>
            </div>
            
            {detailFetching ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                <RefreshCw size={14} style={{ animation: "iiSpin 1s linear infinite" }} />
                {t("incomingInspection.detail.loading")}
              </span>
            ) : (detail?.results.length ?? 0) === 0 ? (
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("incomingInspection.detail.noData")}</span>
            ) : (
              <HistoryTable rows={detail!.results} userNames={userNamesSummary ?? {}} />
            )}
          </div>
        </>
      )}

      {/* ── REJECTED TAB ── */}
      {activeTab === "rejected" && (
        <div style={card}>
          <div style={{ ...cardTitle }}>
            {t("incomingInspection.rejected.title")}
            {rejected && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> ({rejected.count})</span>}
          </div>
          
          {rejectedFetching ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
              <RefreshCw size={14} style={{ animation: "iiSpin 1s linear infinite" }} />
              {t("incomingInspection.detail.loading")}
            </span>
          ) : (rejected?.results.length ?? 0) === 0 ? (
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{t("incomingInspection.detail.noData")}</span>
          ) : (
            <HistoryTable
              rows={rejected!.results}
              userNames={userNamesRejected ?? {}}
              onRowClick={row => setActiveCommentSerial(row.serial_no)}
            />
          )}
        </div>
      )}

      {showSLAModal && <SLAConfigModal onClose={() => setShowSLAModal(false)} />}
      {activeCommentSerial && (
        <CommentsModal serialNo={activeCommentSerial} onClose={() => setActiveCommentSerial(null)} />
      )}
    </div>
  );
}