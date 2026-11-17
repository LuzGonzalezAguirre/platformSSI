import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock3, PackageCheck, Search, X } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import FilterBar from "../../../components/common/FilterBar";
import { useStandardFilters } from "../../../components/common/useStandardFilters";
import apiClient from "../../../services/api.client";
import "./pack-and-ship.css";

interface Kpis {
  pallets_created: number; pallets_closed: number; pieces_packed: number;
  incidents: number; blocked_rejections_current: number;
}
interface Pallet {
  container_id: number; container_code: string; status: string;
  created_at: string; closed_at: string | null; created_by: string | null;
  required_pieces: number; packed_pieces: number; fill_seconds?: number | null;
}
interface Piece {
  container_piece_id: number; container_code: string; part_number: string;
  serial_ssi: string | null; serial_client: string | null; level_number: number;
  scanned_by: string | null; scanned_at: string; business_unit?: string | null;
}
interface Incident {
  event_id: number; rejection_id: number; container_code: string; detected_at: string;
  rejection_type: string; rejection_reason: string; approval_status: string;
  ssi_scan: string; client_scan: string | null; detected_by: string | null;
  resolved_at: string | null;
}
interface Trend {
  date: string; pallets_closed: number; avg_fill_seconds: number;
  min_fill_seconds: number; max_fill_seconds: number;
}
type KpiKey = keyof Kpis;
type Dialog = { kind: "kpi"; key: KpiKey } | { kind: "pallet"; pallet: Pallet } | null;
type Group = "day" | "week" | "month";
const tz = "America/Tijuana";
const time = (date: string | null | undefined, locale: string) =>
  date ? new Date(date.endsWith("Z") ? date : date + "Z").toLocaleString(locale, {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }) : "—";
const durationSeconds = (p: Pallet): number | null => {
  if (p.status !== "CLOSED" || !p.closed_at) return null;
  if (p.fill_seconds !== undefined && p.fill_seconds !== null) return Math.max(0, Number(p.fill_seconds));
  const diff = Date.parse(p.closed_at) - Date.parse(p.created_at);
  return Number.isFinite(diff) && diff >= 0 ? Math.round(diff / 1000) : null;
};
const duration = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  return minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h` :
    minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};
const percent = (part: number, total: number) => total > 0 ? Math.min(100, Math.round(part * 100 / total)) : 0;
const rowsLimit = 2000;
const get = async <T,>(path: string, params: Record<string, unknown>, signal: AbortSignal): Promise<T[]> => {
  const response = await apiClient.get<{ data: T[] }>(`/production/pack-and-ship/${path}/`, { params, signal });
  return response.data.data;
};
const groupDate = (day: string, group: Group): string => {
  if (group === "month") return day.slice(0, 7);
  if (group === "week") {
    const date = new Date(day + "T12:00:00Z");
    const offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  }
  return day;
};
const aggregate = (rows: Trend[], group: Group) => {
  const buckets = new Map<string, { pallets: number; weighted: number }>();
  for (const r of rows) {
    const date = groupDate(r.date, group);
    const previous = buckets.get(date) || { pallets: 0, weighted: 0 };
    const pallets = Number(r.pallets_closed) || 0;
    previous.pallets += pallets;
    previous.weighted += pallets * Number(r.avg_fill_seconds || 0);
    buckets.set(date, previous);
  }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, item]) => ({
    date, count: item.pallets, hours: item.pallets ? +(item.weighted / item.pallets / 3600).toFixed(2) : 0,
  }));
};

export default function PackAndShipPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("es") ? "es-MX" : "en-US";
  const { draft, setDraft, applied, apply } = useStandardFilters("last_7_days");
  const [revision, setRevision] = useState(0);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [closedPallets, setClosedPallets] = useState<Pallet[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [palletPieces, setPalletPieces] = useState<Piece[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [group, setGroup] = useState<Group>("day");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const tr = (key: string) => t(`packAndShip.${key}`);
  const statusLabel = (value: string) => t(`packAndShip.status.${value}`, { defaultValue: value });
  const incidentType = (value: string) => t(`packAndShip.incidentTypes.${value}`, { defaultValue: value.replace(/_/g, " ") });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        if (!applied.start || !applied.end || applied.start > applied.end ||
          (Date.parse(applied.end) - Date.parse(applied.start)) / 86400000 > 366) {
          throw new Error(tr("invalidRange"));
        }
        const params = { start_date: applied.start, end_date: applied.end };
        const [summary, opened, closed, scans, events, series] = await Promise.all([
          get<Kpis>("kpis", params, controller.signal),
          get<Pallet>("pallets", { ...params, limit: rowsLimit }, controller.signal),
          get<Pallet>("closed-pallets", { ...params, limit: rowsLimit }, controller.signal),
          get<Piece>("pieces", { ...params, limit: rowsLimit }, controller.signal),
          get<Incident>("incidents", { ...params, limit: rowsLimit }, controller.signal),
          get<Trend>("trends", params, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setKpis(summary[0] || null);
        setPallets(opened); setClosedPallets(closed); setPieces(scans);
        setIncidents(events); setTrends(series);
        setTruncated([opened, closed, scans, events].some(rows => rows.length >= rowsLimit));
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : tr("loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [applied, revision]); // translation reload handled by i18next render

  useEffect(() => {
    if (!dialog || dialog.kind !== "pallet") return;
    const controller = new AbortController();
    setPalletPieces([]); setDetailError(""); setDetailLoading(true);
    apiClient.get<{ data: Piece[] }>(
      `/production/pack-and-ship/pallets/${dialog.pallet.container_id}/pieces/`,
      { params: { limit: rowsLimit }, signal: controller.signal },
    ).then(({ data }) => { if (!controller.signal.aborted) setPalletPieces(data.data); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setDetailError(e instanceof Error ? e.message : tr("loadError")); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDialog(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const data = useMemo(() => aggregate(trends, group), [trends, group]);
  const filtered = useMemo(() => pallets.filter(row =>
    (status === "ALL" || row.status === status) &&
    [row.container_code, row.created_by || ""].some(text => text.toLowerCase().includes(search.toLowerCase())),
  ), [pallets, status, search]);
  const kpiDefinitions: { key: KpiKey; accent: string }[] = [
    { key: "pallets_created", accent: "#2563eb" }, { key: "pallets_closed", accent: "#10b981" },
    { key: "pieces_packed", accent: "#3b82f6" }, { key: "incidents", accent: "#f59e0b" },
    { key: "blocked_rejections_current", accent: "#ef4444" },
  ];
  const onApply = () => { setDialog(null); apply(); setRevision(v => v + 1); };

  const header = (columns: string[]) => <thead><tr>{columns.map(col => <th key={col}>{tr(`columns.${col}`)}</th>)}</tr></thead>;
  const palletTable = (items: Pallet[]) => <div className="pas-table-scroll"><table className="pas-table">
    {header(["container", "status", "pieces", "progress", "fillTime", "created", "closed", "operator"])}
    <tbody>{items.map(p => <tr key={p.container_id} onClick={() => setDialog({ kind: "pallet", pallet: p })}
      className="pas-clickable" tabIndex={0} role="button" onKeyDown={event => { if (event.key === "Enter") setDialog({ kind: "pallet", pallet: p }); }}>
      <td><strong>{p.container_code}</strong></td>
      <td><span className={`pas-status ${p.status.toLowerCase()}`}>{statusLabel(p.status)}</span></td>
      <td>{p.packed_pieces}/{p.required_pieces}</td>
      <td><span className="pas-progress"><span style={{ width: `${percent(p.packed_pieces, p.required_pieces)}%` }} /></span> {percent(p.packed_pieces, p.required_pieces)}%</td>
      <td>{duration(durationSeconds(p))}</td><td>{time(p.created_at, locale)}</td><td>{time(p.closed_at, locale)}</td><td>{p.created_by || "—"}</td>
    </tr>)}{items.length === 0 && <tr><td colSpan={8} className="pas-empty">{tr("noData")}</td></tr>}</tbody>
  </table></div>;
  const pieceTable = (items: Piece[]) => <div className="pas-table-scroll"><table className="pas-table">
    {header(["container", "part", "ssiSerial", "clientSerial", "level", "operator", "scanned"])}
    <tbody>{items.map(p => <tr key={p.container_piece_id}>
      <td>{p.container_code}</td><td>{p.part_number || "—"}</td><td>{p.serial_ssi || "—"}</td>
      <td>{p.serial_client || "—"}</td><td>{p.level_number}</td><td>{p.scanned_by || "—"}</td><td>{time(p.scanned_at, locale)}</td>
    </tr>)}{!items.length && <tr><td colSpan={7} className="pas-empty">{tr("noData")}</td></tr>}</tbody>
  </table></div>;
  const incidentTable = (items: Incident[]) => <div className="pas-table-scroll"><table className="pas-table">
    {header(["event", "container", "type", "reason", "approval", "detected", "ssiSerial", "clientSerial"])}
    <tbody>{items.map(i => <tr key={i.event_id}>
      <td>#{i.event_id}</td><td>{i.container_code}</td><td>{incidentType(i.rejection_type)}</td>
      <td className="pas-wrap">{i.rejection_reason}</td><td>{i.approval_status}</td>
      <td>{time(i.detected_at, locale)}</td><td>{i.ssi_scan}</td><td>{i.client_scan || "—"}</td>
    </tr>)}{!items.length && <tr><td colSpan={8} className="pas-empty">{tr("noData")}</td></tr>}</tbody>
  </table></div>;

  const modalContent = () => {
    if (!dialog) return null;
    if (dialog.kind === "pallet") {
      const p = dialog.pallet;
      return <>
        <div className="pas-detail-summary"><strong>{p.container_code}</strong>
          <span className={`pas-status ${p.status.toLowerCase()}`}>{statusLabel(p.status)}</span>
          <span>{p.packed_pieces}/{p.required_pieces} {tr("columns.pieces")}</span>
          <span><Clock3 size={15} /> {duration(durationSeconds(p))}</span>
          <span>{time(p.created_at, locale)} → {time(p.closed_at, locale)}</span>
        </div>
        {detailLoading && <div className="pas-info">{tr("loading")}</div>}
        {detailError && <div className="pas-error">{detailError}</div>}
        {!detailLoading && !detailError && pieceTable(palletPieces)}
        {palletPieces.length >= rowsLimit && <p className="pas-muted">{tr("truncated")}</p>}
      </>;
    }
    const key = dialog.key;
    if (key === "pallets_created") return palletTable(pallets);
    if (key === "pallets_closed") return palletTable(closedPallets);
    if (key === "pieces_packed") return pieceTable(pieces);
    if (key === "incidents") return incidentTable(incidents);
    return <div><p className="pas-muted">{tr("blockedNote")}</p>{incidentTable(incidents.filter(i => i.approval_status === "BLOCKED"))}</div>;
  };
  return <div className="pas-page pas-standard">
    <header className="pas-header"><div><h1>{tr("title")}</h1><p className="pas-muted">{tr("subtitle")}</p></div>
      <FilterBar draft={draft} setDraft={setDraft} onApply={onApply} loading={loading}
        showBU={false} showWorkcenter={false} showShift={false} />
    </header>
    {error && <div className="pas-error" role="alert">{error}</div>}
    {loading && <div className="pas-info" role="status">{tr("loading")}</div>}
    {truncated && <div className="pas-info">{tr("truncated")}</div>}
    <section className="pas-kpis">
      {kpiDefinitions.map(({ key, accent }) => <button key={key} className="pas-kpi" onClick={() => setDialog({kind: "kpi", key})}>
        <span className="pas-kpi-label">{tr(`kpis.${key}`)}</span>
        <strong style={{ color: accent }}>{kpis?.[key]?.toLocaleString(locale) ?? "—"}</strong>
        <span className="pas-kpi-hint">{tr("viewDetail")}</span>
      </button>)}
    </section>
    <div className="pas-top-grid">
      <section className="pas-panel">
        <div className="pas-panel-head"><div><h2>{tr("fillTrend")}</h2><p className="pas-muted">{tr("fillTrendNote")}</p></div>
          <div className="pas-tabs">{(["day", "week", "month"] as Group[]).map(g =>
            <button key={g} className={group === g ? "active" : ""} onClick={() => setGroup(g)}>{tr(`group.${g}`)}</button>
          )}</div></div>
        <div className="pas-chart">{data.length ? <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{top: 12,right: 16,left: -12,bottom: 5}}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3"/>
            <XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} unit="h"/>
            <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} h`, tr("hoursAvg")]} />
            <Line type="monotone" dataKey="hours" name={tr("hoursAvg")} stroke="#2563eb" strokeWidth={2} dot={{r:3}} connectNulls={false}/>
          </LineChart></ResponsiveContainer> : <p className="pas-empty">{tr("noClosedData")}</p>}</div>
      </section>
      <section className="pas-panel">
        <div className="pas-panel-head"><div><h2>{tr("dailyPalletTrend")}</h2><p className="pas-muted">{tr("closedByDate")}</p></div>
          <PackageCheck size={20} color="var(--color-text-secondary)"/></div>
        <div className="pas-chart">{data.length ? <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{top:12,right:16,left:-12,bottom:5}}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3"/>
            <XAxis dataKey="date" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} allowDecimals={false}/>
            <Tooltip formatter={(value) => [Number(value), tr("kpis.pallets_closed")]} />
            <Bar dataKey="count" name={tr("kpis.pallets_closed")} fill="#10b981" radius={[4,4,0,0]}/>
          </BarChart></ResponsiveContainer> : <p className="pas-empty">{tr("noClosedData")}</p>}</div>
      </section>
    </div>
    <section className="pas-panel">
      <div className="pas-panel-head"><div><h2>{tr("reportTitle")}</h2><p className="pas-muted">{tr("reportNote")}</p></div>
        <div className="pas-toolbar">
          <label className="pas-search"><Search size={16}/><input aria-label={tr("search")} value={search}
            onChange={e => setSearch(e.target.value)} placeholder={tr("search")}/></label>
          <select aria-label={tr("filterStatus")} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="ALL">{tr("allStatuses")}</option>
            {["OPEN","CLOSED","PARTIAL","CANCELLED","TRANSFERRED"].map(v =>
              <option key={v} value={v}>{statusLabel(v)}</option>)}
          </select>
        </div></div>
      {palletTable(filtered)}
      <p className="pas-muted pas-count">{filtered.length} {tr("records")}</p>
    </section>
    {dialog && <div className="pas-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null); }}>
      <section role="dialog" aria-modal="true" aria-label={dialog.kind === "pallet" ? dialog.pallet.container_code : tr(`kpis.${dialog.key}`)} className="pas-modal">
        <div className="pas-modal-header"><h2>{dialog.kind === "pallet" ? `${tr("palletDetail")}: ${dialog.pallet.container_code}` : tr(`kpis.${dialog.key}`)}</h2>
          <button type="button" className="pas-icon-button" aria-label={tr("close")} onClick={() => setDialog(null)}><X size={19}/></button></div>
        {modalContent()}
      </section></div>}
  </div>;
}
