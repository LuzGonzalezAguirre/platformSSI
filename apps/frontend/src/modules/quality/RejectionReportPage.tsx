// apps/frontend/src/modules/quality/RejectionReportPage.tsx

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Info, X } from "lucide-react";
import apiClient from "../../services/api.client";
import DateRangeSelector from "../../components/common/DateRangeSelector";
import { DateRange, resolvePreset } from "../../components/common/date-presets";
import { QWallService, QWallPartNumber } from "./services/qwall.service";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Inspection {
  result_id:      number;
  inspection_id:  number;
  point_name:     string;
  bu_name:        string;
  inspector_name: string;
  started_at:     string;
  work_order:     number;
  has_photo:      boolean;
}

interface SerialNode {
  serial_number: string;
  frame_sn:      string;
  fpca_sn:       string;
  inspections:   Inspection[];
}

interface FailModeNode {
  fail_mode_id:     number;
  fail_code:        string;
  fail_description: string;
  has_translation:  boolean;
  count:            number;
  serials:          SerialNode[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso: string) => iso.replace("T", " ").slice(0, 16);

// ── Info Modal ────────────────────────────────────────────────────────────────

function InfoModal({ insp, onClose, lang }: {
  insp:    Inspection;
  onClose: () => void;
  lang:    "es" | "en";
}) {
  const l = lang === "es";

  const row = (label: string, value: string | number) => (
    <div style={{
      display: "flex", gap: "0.75rem", padding: "0.45rem 0",
      borderBottom: "1px solid var(--color-border)",
    }}>
      <span style={{ color: "var(--color-text-secondary)", minWidth: 130, fontSize: "0.8rem" }}>
        {label}
      </span>
      <span style={{ color: "var(--color-text-primary)", fontWeight: 600, fontSize: "0.85rem" }}>
        {value}
      </span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--color-surface)", borderRadius: 12,
        padding: "1.5rem", width: 420, maxWidth: "95vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "1.25rem" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary)" }}>
            {l ? "Detalle de inspección" : "Inspection detail"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--color-text-secondary)" }}>
            <X size={18} />
          </button>
        </div>
        {row(l ? "Punto"            : "Point",      insp.point_name)}
        {row("BU",                                   insp.bu_name)}
        {row(l ? "Inspector"        : "Inspector",   insp.inspector_name)}
        {row(l ? "Fecha"            : "Date",        fmt(insp.started_at))}
        {row(l ? "Orden de trabajo" : "Work Order",  insp.work_order)}
      </div>
    </div>
  );
}

// ── Photo ─────────────────────────────────────────────────────────────────────

function RejectionPhoto({ inspectionId, serialNumber, lang }: {
  inspectionId:  number;
  serialNumber:  string;
  lang:          "es" | "en";
}) {
  const l = lang === "es";
  const [photo,   setPhoto]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    apiClient
      .get(`/quality/rejection-photo/${inspectionId}/`)
      .then((res) => { if (!cancelled) setPhoto(res.data.photo_b64); })
      .catch(()  => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inspectionId]);

  const downloadJpg = () => {
    if (!photo) return;
    const safeSn = serialNumber.replace(/[^a-zA-Z0-9_-]/g, "_") || `insp_${inspectionId}`;
    const a      = document.createElement("a");
    a.href       = `data:image/jpeg;base64,${photo}`;
    a.download   = `rechazo_${safeSn}.jpg`;
    a.click();
  };

  if (loading) return (
    <div style={{
      height: 180, display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--color-bg)", borderRadius: 8,
      color: "var(--color-text-secondary)", fontSize: "0.8rem",
    }}>
      {l ? "Cargando foto..." : "Loading photo..."}
    </div>
  );

  if (error || !photo) return (
    <div style={{
      height: 80, display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--color-bg)", borderRadius: 8,
      border: "1px dashed var(--color-border)",
      color: "var(--color-text-secondary)", fontSize: "0.8rem",
    }}>
      {l ? "Sin foto registrada" : "No photo registered"}
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <img
        src={`data:image/jpeg;base64,${photo}`}
        alt="rejection"
        style={{
          width: "100%", borderRadius: 8,
          border: "1px solid var(--color-border)", display: "block",
        }}
      />
      <button
        onClick={downloadJpg}
        title={l ? "Descargar foto" : "Download photo"}
        style={{
          position: "absolute", bottom: 8, right: 8,
          background: "rgba(0,0,0,0.55)", color: "#fff",
          border: "none", borderRadius: 6, padding: "0.3rem 0.6rem",
          fontSize: "0.72rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.3rem",
          backdropFilter: "blur(4px)",
        }}
      >
        ↓
      </button>
    </div>
  );
}

// ── Serial row ────────────────────────────────────────────────────────────────

function SerialRow({ serial, lang, onInfo }: {
  serial:  SerialNode;
  lang:    "es" | "en";
  onInfo:  (i: Inspection) => void;
}) {
  const l = lang === "es";

  return (
    <div style={{ marginLeft: "1.25rem", marginBottom: "0.75rem" }}>
      {serial.inspections.map((insp) => {
        const sn = serial.serial_number || `WO-${insp.work_order}` || "—";
        return (
          <div key={insp.result_id} style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 8, overflow: "hidden", marginBottom: "0.5rem",
          }}>
            {/* SN + fecha + botón info */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.6rem 0.75rem",
              borderBottom: "1px solid var(--color-border)",
            }}>
              <span style={{
                fontFamily: "monospace", fontSize: "0.875rem",
                fontWeight: 700, color: "var(--color-text-primary)", flex: 1,
              }}>
                {sn}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                {fmt(insp.started_at)}
              </span>
              <button
                onClick={() => onInfo(insp)}
                title={l ? "Ver detalle" : "View detail"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  display: "flex", alignItems: "center", padding: "0.1rem",
                  borderRadius: 4,
                }}
              >
                <Info size={15} />
              </button>
            </div>

            {/* Foto siempre visible */}
            <div style={{ padding: "0.75rem" }}>
              {insp.has_photo
                ? (
                  <RejectionPhoto
                    inspectionId={insp.inspection_id}
                    serialNumber={sn}
                    lang={lang}
                  />
                )
                : (
                  <div style={{
                    height: 80, display: "flex", alignItems: "center",
                    justifyContent: "center", background: "var(--color-bg)",
                    borderRadius: 8, border: "1px dashed var(--color-border)",
                    color: "var(--color-text-secondary)", fontSize: "0.8rem",
                  }}>
                    {l ? "Sin foto" : "No photo"}
                  </div>
                )
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fail mode block ───────────────────────────────────────────────────────────

function FailModeBlock({ node, lang, onInfo }: {
  node:   FailModeNode;
  lang:   "es" | "en";
  onInfo: (i: Inspection) => void;
}) {
  const l = lang === "es";

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 10, marginBottom: "0.75rem", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.75rem 1rem",
        background: "rgba(239,68,68,0.07)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <span style={{
          fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700,
          color: "var(--color-text-secondary)",
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 6, padding: "0.15rem 0.5rem",
        }}>
          {node.fail_code}
        </span>
        <span style={{
          fontWeight: 700, fontSize: "0.95rem",
          color: "var(--color-text-primary)", flex: 1,
        }}>
          {node.fail_description}
        </span>
        {!l && !node.has_translation && (
          <span
            title={l ? "" : "No English translation on file"}
            style={{
              fontSize: "0.7rem", color: "#f59e0b",
              border: "1px solid #f59e0b", borderRadius: 4,
              padding: "0.05rem 0.4rem",
            }}
          >
            ES
          </span>
        )}
        <span style={{
          background: "rgba(239,68,68,0.15)",
          color: "#ef4444",
          fontWeight: 700, fontSize: "0.8rem",
          borderRadius: 20, padding: "0.2rem 0.6rem",
          minWidth: 28, textAlign: "center",
        }}>
          {node.count}
        </span>
      </div>

      {/* Serials */}
      <div style={{ padding: "0.75rem 0.5rem 0.25rem" }}>
        {node.serials.map((s) => (
          <SerialRow
            key={s.serial_number || s.frame_sn}
            serial={s}
            lang={lang}
            onInfo={onInfo}
          />
        ))}
      </div>
    </div>
  );
}
// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RejectionReportPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const l    = lang === "es";

  const [dateRange,   setDateRange]   = useState<DateRange>(() => resolvePreset("today"));
  const [buId,        setBuId]        = useState("");
  const [includeTest, setIncludeTest] = useState(false);
  const [data,        setData]        = useState<FailModeNode[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [modal,       setModal]       = useState<Inspection | null>(null);

  // Catálogo dinámico de BU, mismo origen que QWallPage/QWallDashboardPage
  // (ssi_BusinessUnits vía getPartNumbers) -- reemplaza el <option> hardcodeado
  // que le faltaba TULC y no tenía forma de verificar que bu_id=1 fuera Volvo.
  const [partCatalog, setPartCatalog] = useState<QWallPartNumber[]>([]);
  useEffect(() => {
    QWallService.getPartNumbers().then(setPartCatalog).catch(() => {});
  }, []);
  const buCatalog = (() => {
    const seen = new Map<number, string>();
    for (const p of partCatalog) {
      if (!seen.has(p.bu_id)) seen.set(p.bu_id, p.bu_name);
    }
    return [...seen.entries()].map(([id, name]) => ({ bu_id: id, bu_name: name }));
  })();

  const load = useCallback(async () => {
  setLoading(true); setError(null);
  try {
    const params: Record<string, string> = {
      start_date:   dateRange.start,
      end_date:     dateRange.end,
      include_test: includeTest ? "true" : "false",
      lang,
    };
    if (buId) params.bu_id = buId;
    const res = await apiClient.get("/quality/rejection-report/", { params });
    setData(res.data);
  } catch (e: any) {
    setError(e?.response?.data?.detail || (l ? "Error cargando datos" : "Error loading data"));
  } finally {
    setLoading(false);
  }
}, [dateRange, buId, includeTest, lang, l]);

  const downloadPdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({
        start_date:   dateRange.start,
        end_date:     dateRange.end,
        lang:         lang,
        include_test: includeTest ? "true" : "false",
      });
      if (buId) params.append("bu_id", buId);
      const token = localStorage.getItem("mes_access_token");
      const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/quality/rejection-report/pdf/?${params}`,
      { headers: { Authorization: `Bearer ${token ?? ""}` } },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `rechazos_${dateRange.start}_${dateRange.end}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  }, [dateRange, buId, lang, includeTest]);

  const totalRejections = data.reduce((s, n) => s + n.count, 0);

  const inp: React.CSSProperties = {
    background: "var(--color-bg)", border: "1px solid var(--color-border)",
    borderRadius: 6, padding: "0.4rem 0.6rem",
    color: "var(--color-text-primary)", fontSize: "0.875rem",
  };

  const btn = (color: string, disabled = false): React.CSSProperties => ({
    background: disabled ? "var(--color-border)" : color,
    color: "#fff", border: "none", borderRadius: 6,
    padding: "0.45rem 1.1rem", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.875rem", opacity: disabled ? 0.5 : 1,
    display: "flex", alignItems: "center", gap: "0.35rem",
  });

  return (
    <div style={{ padding: "1.5rem" }}>

      {/* Header + Filtros en la misma fila */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>

        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700,
            color: "var(--color-text-primary)" }}>
            {l ? "Piezas Rechazadas" : "Rejected Parts"}
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem",
            color: "var(--color-text-secondary)" }}>
            {l ? "Agrupado por modo de falla" : "Grouped by fail mode"}
          </p>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", alignItems: "flex-end",
          gap: "0.75rem", flexWrap: "wrap" }}>

          {/* Rango de fechas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              {l ? "Fechas" : "Dates"}
            </label>
            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              defaultPreset="today"
            />
          </div>

          {/* Business Unit */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              Business Unit
            </label>
            <select style={inp} value={buId} onChange={(e) => setBuId(e.target.value)}>
              <option value="">{l ? "Todas" : "All"}</option>
              {buCatalog.map((b) => (
                <option key={b.bu_id} value={String(b.bu_id)}>{b.bu_name}</option>
              ))}
            </select>
          </div>

          {/* Toggle Producción / Pruebas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              {l ? "Tipo" : "Type"}
            </label>
            <div style={{
              display: "flex", borderRadius: 6, overflow: "hidden",
              border: "1px solid var(--color-border)",
            }}>
              <button
                onClick={() => setIncludeTest(false)}
                style={{
                  padding: "0.4rem 0.75rem", fontSize: "0.8rem",
                  border: "none", cursor: "pointer",
                  fontWeight: includeTest ? 400 : 700,
                  background: includeTest ? "var(--color-bg)" : "#3b82f6",
                  color: includeTest ? "var(--color-text-secondary)" : "#fff",
                  transition: "all 0.15s",
                }}
              >
                {l ? "Producción" : "Production"}
              </button>
              <button
                onClick={() => setIncludeTest(true)}
                style={{
                  padding: "0.4rem 0.75rem", fontSize: "0.8rem",
                  border: "none", cursor: "pointer",
                  fontWeight: includeTest ? 700 : 400,
                  background: includeTest ? "#f59e0b" : "var(--color-bg)",
                  color: includeTest ? "#fff" : "var(--color-text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {l ? "Pruebas" : "Test"}
              </button>
            </div>
          </div>

          {/* Botón consultar */}
          <button onClick={load} disabled={loading} style={btn("#3b82f6", loading)}>
            {loading ? (l ? "Cargando..." : "Loading...") : (l ? "Consultar" : "Load")}
          </button>

          {/* PDF */}
          <button
            onClick={downloadPdf}
            disabled={pdfLoading || data.length === 0}
            style={btn("#ef4444", pdfLoading || data.length === 0)}
            title={l ? "Descargar PDF completo con fotos" : "Download full PDF with photos"}
          >
            {pdfLoading ? "..." : "↓ PDF"}
          </button>
        </div>
      </div>

      {/* Contador total */}
      {!loading && data.length > 0 && (
        <div style={{
          marginBottom: "1rem", fontSize: "0.8rem",
          color: "var(--color-text-secondary)",
        }}>
          {totalRejections}{" "}
          {l ? "rechazo(s) encontrado(s)" : "rejection(s) found"}
          {" · "}
          {includeTest
            ? (l ? "modo pruebas" : "test mode")
            : (l ? "producción" : "production")}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && data.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem",
          color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          {l ? "Sin rechazos en el período seleccionado"
             : "No rejections in the selected period"}
        </div>
      )}

      {/* Tree */}
      {data.map((node) => (
        <FailModeBlock
          key={node.fail_mode_id}
          node={node}
          lang={lang}
          onInfo={setModal}
        />
      ))}

      {/* Modal */}
      {modal && (
        <InfoModal
          insp={modal}
          onClose={() => setModal(null)}
          lang={lang}
        />
      )}
    </div>
  );
}