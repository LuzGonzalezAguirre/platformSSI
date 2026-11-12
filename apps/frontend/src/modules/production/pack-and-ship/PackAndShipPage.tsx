import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, ClipboardList, Package, RefreshCw, Search, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import apiClient from "../../../services/api.client";
import "./pack-and-ship.css";

type Kpis = { pallets_created: number; pallets_closed: number; pieces_packed: number; incidents: number; blocked_rejections_current: number };
type Pallet = { container_id: number; container_code: string; configuration_id: number; status: string; created_at: string; closed_at: string | null; created_by: string | null; required_pieces: number; packed_pieces: number };
type Piece = { container_piece_id: number; product_id: number; scanned_at: string; scanned_by: string | null; container_code: string; container_status: string; level_number: number; serial_ssi: string | null; serial_client: string | null; part_number: string; business_unit: string | null };
type Incident = { event_id: number; event_token: string; rejection_id: number; detected_at: string; rejection_type: string; ssi_scan: string; client_scan: string | null; rejection_reason: string; container_code: string; detected_by: string | null; approval_status: string; resolved_at: string | null };
type Tab = "pallets" | "pieces";
type ApiData<T> = { data: T[] };
const todayUTC = () => new Date().toISOString().slice(0, 10);
const daysAgoUTC = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const fmt = (s?: string | null) => s ? new Date(s.endsWith("Z") ? s : s + "Z").toLocaleString("es-MX", { timeZone: "America/Tijuana", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const label = (value: string) => ({ DUPLICATE_SAME: "Duplicado en el mismo pallet", DUPLICATE_OTHER: "Duplicado en otro pallet", QWALL_REJECT: "Rechazo Q-Wall" } as Record<string,string>)[value] || value.replaceAll("_", " ");
const pct = (numerator: number, denominator: number) => denominator ? Math.min(100, Math.round(numerator / denominator * 100)) : 0;

export default function PackAndShipPage() {
  const [startDate, setStartDate] = useState(daysAgoUTC(7));
  const [endDate, setEndDate] = useState(todayUTC());
  const [applied, setApplied] = useState({ start_date: daysAgoUTC(7), end_date: todayUTC() });
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<Tab>("pallets");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showIncidents, setShowIncidents] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = applied;
      const endpoints = ["kpis", "pallets", "pieces", "incidents"] as const;
      const results = await Promise.all(endpoints.map(resource =>
        apiClient.get<ApiData<Kpis | Pallet | Piece | Incident>>(`/production/pack-and-ship/${resource}/`, {
          params: resource === "kpis" ? params : { ...params, limit: 2000 }, signal,
        })
      ));
      if (signal.aborted) return;
      const [summary, containerRows, pieceRows, incidentRows] = results.map(r => r.data.data);
      setKpis(summary[0] as Kpis || null);
      setPallets(containerRows as Pallet[]);
      setPieces(pieceRows as Piece[]);
      setIncidents(incidentRows as Incident[]);
      setPartial([containerRows, pieceRows, incidentRows].some(rows => rows.length === 2000));
    } catch (e: unknown) {
      if (signal.aborted) return;
      setError(e instanceof Error ? e.message : "No se pudieron consultar los datos.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [applied, refresh]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const shownPallets = useMemo(() => pallets.filter(p =>
    (status === "ALL" || p.status === status) &&
    [p.container_code, p.created_by || "", p.status].some(v => v.toLowerCase().includes(search.toLowerCase()))
  ), [pallets, status, search]);
  const shownPieces = useMemo(() => pieces.filter(p =>
    [p.container_code, p.serial_ssi || "", p.serial_client || "", p.part_number, p.scanned_by || "", p.business_unit || ""]
      .some(v => v.toLowerCase().includes(search.toLowerCase()))
  ), [pieces, search]);
  const statusChart = useMemo(() =>
    ["OPEN", "CLOSED", "PARTIAL", "CANCELLED", "TRANSFERRED"].map(name => ({
      name, total: pallets.filter(p => p.status === name).length,
    })).filter(v => v.total > 0), [pallets]);
  const onApply = (event: React.FormEvent) => {
    event.preventDefault();
    if (endDate < startDate) { setError("La fecha final debe ser igual o posterior a la inicial."); return; }
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000;
    if (days > 366) { setError("El periodo máximo es de 366 días."); return; }
    setApplied({ start_date: startDate, end_date: endDate });
    setRefresh(n => n + 1);
  };

  return <div className="pas-page">
    <header className="pas-header">
      <div><div className="pas-eyebrow">Production / Packaging</div><h1>Pack and Ship</h1><p>Seguimiento de pallets, piezas e incidencias de empaque.</p></div>
      <button className="pas-button" onClick={() => setRefresh(n => n + 1)} disabled={loading}><RefreshCw size={16}/> Actualizar</button>
    </header>
    <form className="pas-filters" onSubmit={onApply}>
      <label>Desde (UTC)<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}/></label>
      <label>Hasta (UTC)<input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}/></label>
      <button className="pas-button primary" type="submit">Aplicar periodo</button>
      <span className="pas-note">Las fechas se consultan en UTC; las horas se muestran en Tijuana.</span>
    </form>
    {error && <div role="alert" className="pas-error">{error}</div>}
    {loading && <div role="status" className="pas-info">Consultando datos de CCS…</div>}
    {partial && <div className="pas-info">Hay al menos un reporte con 2,000 registros. Los listados y gráficas de detalle están limitados; los KPIs se calculan en CCS.</div>}
    <section className="pas-kpis">
      {[
        { title: "Pallets creados", number: kpis?.pallets_created, icon: <Package size={19}/> },
        { title: "Pallets cerrados", number: kpis?.pallets_closed, icon: <CheckCircle2 size={19}/> },
        { title: "Piezas empacadas", number: kpis?.pieces_packed, icon: <Boxes size={19}/> },
        { title: "Incidencias", number: kpis?.incidents, icon: <AlertTriangle size={19}/> },
        { title: "Bloqueos actuales", number: kpis?.blocked_rejections_current, icon: <ClipboardList size={19}/> },
      ].map(card => <div className="pas-kpi" key={card.title}><div className="pas-kpi-label">{card.title}{card.icon}</div><strong>{card.number?.toLocaleString("es-MX") ?? "—"}</strong></div>)}
    </section>
    <div className="pas-top-grid">
      <section className="pas-panel"><h2>Estado de pallets</h2><p className="pas-muted">Pallets creados en el periodo. El estado corresponde al momento actual.</p>
        <div className="pas-chart">{statusChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={statusChart} margin={{ top: 10, right: 12, bottom: 8, left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="total" name="Pallets" fill="#2563eb" radius={[5, 5, 0, 0]}/></BarChart></ResponsiveContainer> : <p className="pas-muted">No hay pallets para graficar.</p>}</div>
      </section>
      <section className="pas-panel pas-incidents-overview"><div className="pas-panel-head"><h2>Incidencias</h2><button className="pas-button" onClick={() => setShowIncidents(true)}><AlertTriangle size={16}/> Ver incidencias</button></div>
        <p className="pas-muted">Cada evento detectado en CCS se cuenta individualmente, aunque comparta bloqueo.</p>
        <div className="pas-incidents-total">{kpis?.incidents ?? "—"} <span>eventos en el periodo</span></div>
        <div className="pas-breakdown">{Array.from(new Set(incidents.map(i => i.rejection_type))).map(type => <div key={type}><span>{label(type)}</span><strong>{incidents.filter(i => i.rejection_type === type).length}</strong></div>)}</div>
      </section>
    </div>
    <section className="pas-panel">
      <div className="pas-panel-head"><div><h2>Reporte detallado</h2><p className="pas-muted">Pallets por fecha de creación; piezas por fecha de escaneo.</p></div><div className="pas-tabs"><button className={tab === "pallets" ? "active" : ""} onClick={() => setTab("pallets")}>Pallets</button><button className={tab === "pieces" ? "active" : ""} onClick={() => setTab("pieces")}>Piezas</button></div></div>
      <div className="pas-toolbar"><label className="pas-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contenedor, modelo o serial…"/></label>{tab === "pallets" && <select aria-label="Filtrar estado" value={status} onChange={e => setStatus(e.target.value)}>{["ALL", "OPEN", "CLOSED", "PARTIAL", "CANCELLED", "TRANSFERRED"].map(value => <option key={value} value={value}>{value === "ALL" ? "Todos los estados" : value}</option>)}</select>}</div>
      <div className="pas-table-scroll"><table className="pas-table"><thead>{tab === "pallets" ? <tr><th>Contenedor</th><th>Estado</th><th>Piezas</th><th>Avance</th><th>Creado</th><th>Cerrado</th><th>Operador</th></tr> : <tr><th>Contenedor</th><th>Parte</th><th>Serial SSI</th><th>Serial Cliente</th><th>Nivel</th><th>Operador</th><th>Escaneado</th></tr>}</thead><tbody>
      {tab === "pallets" ? shownPallets.map(p => <tr key={p.container_id}><td><strong>{p.container_code}</strong></td><td><span className={`pas-status ${p.status.toLowerCase()}`}>{p.status}</span></td><td>{p.packed_pieces} / {p.required_pieces}</td><td><div className="pas-progress"><div style={{width: `${pct(p.packed_pieces, p.required_pieces)}%`}}/></div>{pct(p.packed_pieces, p.required_pieces)}%</td><td>{fmt(p.created_at)}</td><td>{fmt(p.closed_at)}</td><td>{p.created_by || "—"}</td></tr>) :
      shownPieces.map(p => <tr key={p.container_piece_id}><td>{p.container_code}</td><td>{p.part_number}</td><td>{p.serial_ssi || "—"}</td><td>{p.serial_client || "—"}</td><td>{p.level_number}</td><td>{p.scanned_by || "—"}</td><td>{fmt(p.scanned_at)}</td></tr>)}
      {(tab === "pallets" ? shownPallets.length === 0 : shownPieces.length === 0) && <tr><td colSpan={7} className="pas-empty">{loading ? "Cargando…" : "Sin registros para estos filtros."}</td></tr>}</tbody></table></div>
      <p className="pas-muted pas-count">{tab === "pallets" ? shownPallets.length : shownPieces.length} registros mostrados</p>
    </section>
    {showIncidents && <div className="pas-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { setShowIncidents(false); setSelectedIncident(null); } }}><section role="dialog" aria-modal="true" aria-label="Incidencias de empaque" className="pas-modal">
      <div className="pas-modal-header"><div><h2>Incidencias de Pack and Ship</h2><p className="pas-muted">Eventos detectados entre {applied.start_date} y {applied.end_date} (UTC)</p></div><button className="pas-icon-button" aria-label="Cerrar" onClick={() => {setShowIncidents(false);setSelectedIncident(null);}}><X/></button></div>
      <div className="pas-table-scroll"><table className="pas-table"><thead><tr><th>Evento</th><th>Fecha Tijuana</th><th>Contenedor</th><th>Tipo</th><th>Autorización</th><th></th></tr></thead><tbody>{incidents.map(i => <tr key={i.event_id}><td>#{i.event_id}</td><td>{fmt(i.detected_at)}</td><td>{i.container_code}</td><td>{label(i.rejection_type)}</td><td><span className={`pas-status ${i.approval_status === "APPROVED" ? "closed" : "open"}`}>{i.approval_status}</span></td><td><button className="pas-link" onClick={() => setSelectedIncident(i)}>Detalle</button></td></tr>)}{incidents.length === 0 && <tr><td colSpan={6} className="pas-empty">Sin incidencias.</td></tr>}</tbody></table></div>
      {selectedIncident && <div className="pas-incident-detail"><div className="pas-panel-head"><h3>Evento #{selectedIncident.event_id}</h3><button className="pas-icon-button" aria-label="Cerrar detalle" onClick={() => setSelectedIncident(null)}><X size={18}/></button></div><dl>
        <dt>Tipo</dt><dd>{label(selectedIncident.rejection_type)}</dd><dt>Contenedor</dt><dd>{selectedIncident.container_code}</dd><dt>Serial SSI</dt><dd>{selectedIncident.ssi_scan}</dd><dt>Serial cliente</dt><dd>{selectedIncident.client_scan || "—"}</dd><dt>Motivo</dt><dd>{selectedIncident.rejection_reason}</dd><dt>Detectado por</dt><dd>{selectedIncident.detected_by || "—"}</dd><dt>Bloqueo</dt><dd>#{selectedIncident.rejection_id} · {selectedIncident.approval_status}</dd><dt>Resuelto</dt><dd>{fmt(selectedIncident.resolved_at)}</dd>
      </dl><p className="pas-muted">El detalle de firmas por departamento se incorporará cuando esté disponible el endpoint de aprobaciones.</p></div>}
    </section></div>}
  </div>;
}
