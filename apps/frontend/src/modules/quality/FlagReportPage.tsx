import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Download, Info, X } from "lucide-react";
import apiClient from "../../services/api.client";
import DateRangeSelector from "../../components/common/DateRangeSelector";
import { DateRange, resolvePreset } from "../../components/common/date-presets";
import { QWallService, QWallPartNumber } from "./services/qwall.service";

type Flag = {
  flag_id: number;
  inspection_id: number | null;
  created_at: string;
  inspection_started_at?: string | null;
  point_name?: string | null;
  comment: string | null;
  work_order: string | number | null;
  serial_number: string | null;
  frame_sn: string | null;
  fpca_sn: string | null;
  part_number: string | null;
  model?: string | null;
  bu_id: number;
  bu_name: string | null;
  inspector_name: string | null;
  fail_mode_code: string | null;
  fail_mode_name: string | null;
  has_photo: boolean | number;
  total_photos: number;
};

type FlagPhoto = { photo_id: number; photo_b64: string | null; taken_at: string | null };

function EvidencePhoto({ flag, english }: { flag: Flag; english: boolean }) {
  const [photos, setPhotos] = useState<FlagPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setPhotos([]);
    setFailed(false);
    if (!flag.inspection_id || !flag.total_photos) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiClient.get(`/quality/flags/${flag.flag_id}/photos/`)
      .then(({ data }) => { if (active) setPhotos(data.data ?? []); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [flag.flag_id, flag.inspection_id, flag.total_photos]);

  if (!flag.total_photos) return <p>{english ? "No linked photos" : "Sin fotografías vinculadas"}</p>;
  if (loading) return <p>{english ? "Loading photos..." : "Cargando fotografías..."}</p>;
  if (failed) return <p role="alert">{english ? "Could not load photos" : "No se pudieron cargar las fotografías"}</p>;
  if (!photos.length) return <p>{english ? "No photo data returned" : "No se recibieron fotografías"}</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {photos.map((photo, index) => {
        if (!photo.photo_b64) return <p key={photo.photo_id}>{english ? "Photo unavailable" : "Foto no disponible"} #{photo.photo_id}</p>;
        const src = `data:image/jpeg;base64,${photo.photo_b64}`;
        const download = () => {
          const link = document.createElement("a");
          link.href = src;
          link.download = `flag_${flag.flag_id}_foto_${index + 1}.jpg`;
          link.click();
        };
        return (
          <div key={photo.photo_id}>
            <img src={src} alt={english ? `Flag evidence ${index + 1}` : `Evidencia ${index + 1}`}
              style={{ display: "block", maxWidth: "100%", maxHeight: 500, objectFit: "contain", borderRadius: 8 }} />
            <button type="button" onClick={download} style={{ marginTop: 10, padding: "0.5rem 0.75rem", cursor: "pointer" }}>
              <Download size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {english ? `Download photo ${index + 1}` : `Descargar foto ${index + 1}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const printable = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const dateTime = (value: string | null | undefined) => value ? value.replace("T", " ").slice(0, 19) : "—";

export default function FlagReportPage() {
  const { i18n } = useTranslation();
  const english = !i18n.language.startsWith("es");
  const [dateRange, setDateRange] = useState<DateRange>(() => resolvePreset("today"));
  const [buId, setBuId] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [woFilter, setWoFilter] = useState("");
  const [catalog, setCatalog] = useState<QWallPartNumber[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [selected, setSelected] = useState<Flag | null>(null);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { QWallService.getPartNumbers().then(setCatalog).catch(() => {}); }, []);
  const businessUnits = useMemo(() => {
    const units = new Map<number, string>();
    catalog.forEach((part) => units.set(part.bu_id, part.bu_name));
    return [...units].sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalog]);

  // Model is the CCS part catalog's volvoProductNumber; support older proxy responses
  // by falling back to that same catalog field for matching BU and part number.
  const catalogModels = useMemo(() => {
    const result = new Map<string, string>();
    for (const item of catalog) {
      if (item.volvoProductNumber) {
        result.set(`${item.bu_id}|${item.ssiPN}`, item.volvoProductNumber);
      }
    }
    return result;
  }, [catalog]);

  const modelFor = (flag: Flag) =>
    flag.model || catalogModels.get(`${flag.bu_id}|${flag.part_number}`) || "";

  const modelOptions = useMemo(
    () => [...new Set(flags.map(modelFor).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [flags, catalogModels],
  );

  const filteredFlags = useMemo(() => {
    const part = partFilter.trim().toLocaleLowerCase();
    const model = modelFilter.trim().toLocaleLowerCase();
    const wo = woFilter.trim().toLocaleLowerCase();
    return flags.filter(flag =>
      (!part || String(flag.part_number || "").toLocaleLowerCase().includes(part)) &&
      (!model || modelFor(flag).toLocaleLowerCase().includes(model)) &&
      (!wo || String(flag.work_order ?? "").toLocaleLowerCase().includes(wo))
    );
  }, [flags, partFilter, modelFilter, woFilter, catalogModels]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQueried(true);
    setSelected(null);
    try {
      const params: Record<string, string> = { start_date: dateRange.start, end_date: dateRange.end };
      if (buId) params.bu_id = buId;
      const response = await apiClient.get("/quality/flags/", { params });
      setFlags(response.data.data ?? []);
    } catch {
      setFlags([]);
      setError(english ? "Could not load flagged pieces." : "No fue posible cargar las piezas marcadas.");
    } finally {
      setLoading(false);
    }
  }, [dateRange, buId, english]);

  const label: React.CSSProperties = { color: "var(--color-text-secondary)", fontSize: "0.78rem" };
  const input: React.CSSProperties = { background: "var(--color-bg)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", padding: "0.45rem", borderRadius: 6 };
  const detail = (name: string, value: unknown) => (
    <div style={{ display: "flex", gap: 12, padding: "0.55rem 0", borderBottom: "1px solid var(--color-border)" }}>
      <span style={{ ...label, minWidth: 125 }}>{name}</span>
      <span style={{ overflowWrap: "anywhere" }}>{printable(value)}</span>
    </div>
  );

  return (
    <div style={{ padding: "1.5rem", color: "var(--color-text-primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "end", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>{english ? "Flagged Pieces" : "Piezas Flageadas"}</h1>
          <p style={{ ...label, marginTop: 6 }}>{english ? "Read-only flag details and available inspection evidence" : "Consulta de comentarios y evidencias disponibles por pieza"}</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div><div style={label}>{english ? "Dates" : "Fechas"}</div><DateRangeSelector value={dateRange} onChange={setDateRange} defaultPreset="today" /></div>
          <label style={label}>Business Unit
            <select value={buId} onChange={e => setBuId(e.target.value)} style={{ ...input, display: "block", marginTop: 4 }}>
              <option value="">{english ? "All" : "Todas"}</option>
              {businessUnits.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label style={label}>{english ? "Part number" : "Número de parte"}
            <input type="search" value={partFilter} onChange={e => setPartFilter(e.target.value)}
              placeholder={english ? "Search part..." : "Buscar parte..."}
              style={{ ...input, display: "block", marginTop: 4, width: 145 }} />
          </label>
          <label style={label}>{english ? "Model" : "Modelo"}
            <select value={modelFilter} onChange={e => setModelFilter(e.target.value)}
              style={{ ...input, display: "block", marginTop: 4, maxWidth: 170 }}>
              <option value="">{english ? "All models" : "Todos los modelos"}</option>
              {modelOptions.map(model => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <label style={label}>WO
            <input type="search" value={woFilter} onChange={e => setWoFilter(e.target.value)}
              placeholder={english ? "Work order..." : "Orden de trabajo..."}
              style={{ ...input, display: "block", marginTop: 4, width: 145 }} />
          </label>
          <button type="button" onClick={() => { setPartFilter(""); setModelFilter(""); setWoFilter(""); }}
            disabled={!partFilter && !modelFilter && !woFilter}
            style={{ ...input, cursor: "pointer" }}>
            {english ? "Clear filters" : "Limpiar filtros"}
          </button>
          <button type="button" onClick={load} disabled={loading} style={{ ...input, cursor: "pointer", background: "#3b82f6", color: "white" }}>
            {loading ? (english ? "Loading..." : "Cargando...") : (english ? "Load" : "Consultar")}
          </button>
        </div>
      </div>
      {error && <p role="alert" style={{ color: "#ef4444" }}>{error}</p>}
      {!loading && !error && queried && <p style={label}>{filteredFlags.length} {english ? "flag(s) shown" : "flag(s) mostrados"} {filteredFlags.length !== flags.length && ` / ${flags.length}`}</p>}
      {!loading && !error && queried && filteredFlags.length === 0 && <p>{english ? "No flags in the selected date range." : "Sin piezas flageadas en el período seleccionado."}</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {filteredFlags.map(flag => (
          <article key={flag.flag_id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <strong>{printable(flag.point_name || flag.fail_mode_name || flag.part_number)}</strong>
                <div style={label}>{printable(flag.part_number)} · {printable(modelFor(flag))} · {printable(flag.bu_name)} · WO {printable(flag.work_order)} · {dateTime(flag.inspection_started_at || flag.created_at)}</div>
              </div>
              {Number(flag.total_photos) > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Camera size={17} aria-label="Foto" />{flag.total_photos}</span>}
              <button type="button" onClick={() => setSelected(flag)} style={{ ...input, cursor: "pointer" }}>
                <Info size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{english ? "Details" : "Ver detalle"}
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <strong>{printable(flag.fail_mode_name || flag.fail_mode_code)}</strong>
              <p style={{ whiteSpace: "pre-wrap", margin: "0.5rem 0 0" }}>{flag.comment || (english ? "No comment" : "Sin comentarios")}</p>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <div role="presentation" onClick={e => { if (e.currentTarget === e.target) setSelected(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label={english ? "Flag details" : "Detalle de Flag"}
            style={{ maxWidth: 700, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, borderRadius: 12, background: "var(--color-surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Flag #{selected.flag_id}</h2>
              <button type="button" aria-label={english ? "Close" : "Cerrar"} onClick={() => setSelected(null)}
                style={{ border: 0, background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            {detail("Point", selected.point_name)}
            {detail("BU", selected.bu_name)}
            {detail("Inspector", selected.inspector_name)}
            {detail("Date", dateTime(selected.inspection_started_at || selected.created_at).slice(0, 16))}
            {detail("Work Order", selected.work_order)}
            <h3 style={{ marginBottom: 6 }}>{english ? "Comment" : "Comentario"}</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{selected.comment || (english ? "No comment" : "Sin comentarios")}</p>
            <h3>{english ? "Linked inspection photo" : "Fotografía vinculada a inspección"}</h3>
            <EvidencePhoto key={selected.flag_id} flag={selected} english={english} />
          </div>
        </div>
      )}
    </div>
  );
}
