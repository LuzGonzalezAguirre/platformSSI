import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react";
import {
  failureCatalogApi,
  type BusinessUnit,
  type InspectionPoint,
  type FailureMode,
} from "./failureCatalogApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFileAsBase64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve({ data: reader.result as string, mime: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Image Viewer (lightbox) ──────────────────────────────────────────────────

function ImageViewer({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.lightbox} onClick={e => e.stopPropagation()}>
        <div style={s.lightboxHeader}>
          <span style={s.lightboxTitle}>{name}</span>
          <button style={s.iconBtn} onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <img src={src} alt={name} style={s.lightboxImg} />
      </div>
    </div>
  );
}

// ─── Manage Images Modal (lista de modos de falla con upload) ─────────────────

interface ManageModalProps {
  point: InspectionPoint;
  onClose: () => void;
  onSaved: () => void;
}

function ManageModal({ point, onClose, onSaved }: ManageModalProps) {
  const [modes, setModes] = useState<FailureMode[]>(point.fail_modes);
  const [viewImg, setViewImg] = useState<FailureMode | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // keep modes in sync with parent after save
  useEffect(() => { setModes(point.fail_modes); }, [point.fail_modes]);

  return (
    <>
      <div style={s.overlay} onClick={onClose}>
        <div style={s.modal} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={s.modalHeader}>
            <div>
              <p style={s.modalSub}>Gestionar imágenes</p>
              <h2 style={s.modalTitle}>{point.name}</h2>
            </div>
            <button style={s.iconBtn} onClick={onClose}><Icons.X size={20} /></button>
          </div>

          {/* List */}
          <div style={s.modalBody}>
            {modes.length === 0 ? (
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", padding: "1rem 0" }}>
                No hay modos de falla registrados para este punto de inspección.
              </p>
            ) : (
              <ul style={s.modeList}>
                {modes.map(fm => (
                  <ModeRow
                    key={fm.id}
                    pointName={point.name}
                    mode={fm}
                    onViewImage={() => setViewImg(fm)}
                    onSaved={onSaved}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {viewImg && viewImg.has_image && (
        <ImageViewer
          src={viewImg.image_data}
          name={viewImg.name}
          onClose={() => setViewImg(null)}
        />
      )}
    </>
  );
}

// ─── Mode Row (dentro del modal) ──────────────────────────────────────────────

interface ModeRowProps {
  pointName: string;
  mode: FailureMode;
  onViewImage: () => void;
  onSaved: () => void;
}

function ModeRow({ pointName, mode, onViewImage, onSaved }: ModeRowProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDel, setConfirm]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Máximo 5 MB por imagen."); return; }
    setUploading(true);
    try {
      const { data, mime } = await readFileAsBase64(file);
      await failureCatalogApi.saveImage({
        inspection_point: pointName,
        failure_mode:     mode.fail_code,
        image_data:       data,
        image_mime:       mime,
      });
      onSaved();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await failureCatalogApi.deleteImage(pointName, mode.fail_code);
      onSaved();
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  };

  return (
    <li style={s.modeRow}>
      {/* Thumbnail */}
      <div
        style={{ ...s.rowThumb, cursor: mode.has_image ? "pointer" : "default" }}
        onClick={() => mode.has_image && onViewImage()}
        title={mode.has_image ? "Ver imagen" : undefined}
      >
        {mode.has_image ? (
          <img src={mode.image_data} alt={mode.name} style={s.rowThumbImg} />
        ) : (
          <Icons.ImageOff size={18} color="var(--color-text-secondary)" />
        )}
      </div>

      {/* Name */}
      <span style={s.rowName}>{mode.name}</span>

      {/* Actions */}
      <div style={s.rowActions}>
        {!confirmDel ? (
          <>
            <button
              style={s.btnUpload}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              title={mode.has_image ? "Reemplazar imagen" : "Subir imagen"}
            >
              {uploading
                ? <Icons.Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                : <Icons.Upload size={13} />
              }
              <span>{uploading ? "Subiendo..." : mode.has_image ? "Reemplazar" : "Subir"}</span>
            </button>

            {mode.has_image && (
              <button style={s.btnRemove} onClick={() => setConfirm(true)} title="Eliminar imagen">
                <Icons.Trash2 size={13} />
              </button>
            )}
          </>
        ) : (
          <>
            <button style={s.btnConfirmDel} onClick={handleDelete} disabled={deleting}>
              {deleting ? "..." : "Confirmar"}
            </button>
            <button style={s.btnCancelDel} onClick={() => setConfirm(false)}>Cancelar</button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </li>
  );
}

// ─── Fail Mode Card (solo lectura — imagen + nombre) ─────────────────────────

function FailureModeCard({ mode, onZoom, fillMode, lang }: {
  mode: FailureMode; onZoom: () => void; fillMode?: boolean; lang: "es" | "en";
}) {
  const l = lang === "es";
  return (
    <div
      style={{ ...s.card, cursor: mode.has_image ? "pointer" : "default", aspectRatio: fillMode ? "unset" : "4 / 3" }}
      onClick={() => mode.has_image && onZoom()}
      title={mode.has_image ? "Ver imagen" : undefined}
    >
      {mode.has_image ? (
        <img src={mode.image_data} alt={mode.name} style={s.cardImgEl} />
      ) : (
        <div style={s.cardImgEmpty}>
          <Icons.ImageOff size={32} color="var(--color-text-secondary)" />
          <span style={s.noImgText}>Sin imagen</span>
        </div>
      )}
      <div style={s.cardOverlay}>
        <span style={{
          fontFamily: "monospace", fontSize: "0.65rem", fontWeight: 700,
          color: "rgba(255,255,255,0.8)", display: "block", marginBottom: "0.15rem",
        }}>
          {mode.fail_code}
          {!l && !mode.has_translation && (
            <span style={{ marginLeft: "0.4rem", color: "#f59e0b" }}>ES</span>
          )}
        </span>
        <p style={s.cardTitle}>{mode.name}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FailureCatalogPage() {
  const { i18n } = useTranslation();
  const lang: "es" | "en" = i18n.language.startsWith("es") ? "es" : "en";

  const [units, setUnits]                   = useState<BusinessUnit[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState("");
  const [selectedUnit, setSelectedUnit]     = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint]   = useState<number | null>(null);
  const [managePoint, setManagePoint]       = useState<InspectionPoint | null>(null);
  const [viewImg, setViewImg]               = useState<FailureMode | null>(null);
  const [search, setSearch]                 = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await failureCatalogApi.getStructure(lang);
      setUnits(data);
      if (data.length > 0) {
        setSelectedUnit(prev => prev ?? data[0].id);
        const firstUnit = data[0];
        if (firstUnit.inspection_points.length > 0) {
          setSelectedPoint(prev => prev ?? firstUnit.inspection_points[0].id);
        }
      }
    } catch {
      setError("No se pudo cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [lang]);

  const activeUnit  = units.find(u => u.id === selectedUnit) ?? null;
  const activePoint = activeUnit?.inspection_points.find(p => p.id === selectedPoint) ?? null;

  // When managePoint is open, keep it in sync with fresh data after save
  const refreshManagePoint = async () => {
    if (!managePoint) return;
    await load();
  };

  const filteredModes = (activePoint?.fail_modes ?? []).filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const withImage    = filteredModes.filter(m => m.has_image).length;
  const withoutImage = filteredModes.length - withImage;

  // After a save/reload, sync managePoint with updated data
  useEffect(() => {
    if (!managePoint) return;
    const freshUnit  = units.find(u => u.inspection_points.some(ip => ip.id === managePoint.id));
    const freshPoint = freshUnit?.inspection_points.find(ip => ip.id === managePoint.id);
    if (freshPoint) setManagePoint(freshPoint);
  }, [units]);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Catálogo de Fallas</h1>
          <p style={s.subtitle}>Imágenes de referencia por cliente, punto de inspección y modo de falla</p>
        </div>
        <button style={s.btnRefresh} onClick={load} disabled={loading} title="Recargar">
          <Icons.RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
        </button>
      </div>

      {error && (
        <div style={s.errorBanner}>
          <Icons.AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={s.centerMsg}>
          <Icons.Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
          <p>Cargando catálogo...</p>
        </div>
      ) : units.length === 0 ? (
        <div style={s.centerMsg}>
          <Icons.BookOpen size={36} color="var(--color-text-secondary)" />
          <p style={{ color: "var(--color-text-secondary)" }}>
            No hay clientes configurados.<br />Agrega Business Units desde el panel de administración.
          </p>
        </div>
      ) : (
        <>
          {/* Business Unit Tabs */}
          <div style={s.tabs}>
            {units.map(u => (
              <button
                key={u.id}
                style={{
                  ...s.tab,
                  ...(u.id === selectedUnit ? s.tabActive : {}),
                }}
                onClick={() => {
                  setSelectedUnit(u.id);
                  const firstIp = u.inspection_points[0];
                  setSelectedPoint(firstIp?.id ?? null);
                  setSearch("");
                }}
              >
                {u.name}
              </button>
            ))}
          </div>

          {activeUnit && (
            <div style={s.layout}>
              {/* LEFT — Inspection Points */}
              <aside style={s.aside}>
                <p style={s.asideLabel}>PUNTOS DE INSPECCIÓN</p>
                {activeUnit.inspection_points.length === 0 ? (
                  <p style={s.asideEmpty}>Sin puntos de inspección</p>
                ) : (
                  <ul style={s.pointList}>
                    {activeUnit.inspection_points.map(ip => {
                      const total   = ip.fail_modes.length;
                      const covered = ip.fail_modes.filter(m => m.has_image).length;
                      const pct     = total > 0 ? Math.round((covered / total) * 100) : 0;
                      const active  = ip.id === selectedPoint;
                      return (
                        <li
                          key={ip.id}
                          style={{ ...s.pointItem, ...(active ? s.pointItemActive : {}) }}
                          onClick={() => { setSelectedPoint(ip.id); setSearch(""); }}
                        >
                          <div style={s.pointItemTop}>
                            <span style={s.pointName}>{ip.name}</span>
                            <button
                              style={s.btnManage}
                              onClick={e => { e.stopPropagation(); setManagePoint(ip); }}
                              title="Gestionar imágenes"
                            >
                              <Icons.Settings size={13} />
                            </button>
                          </div>
                          <div style={s.pointProgress}>
                            <div style={s.progressBar}>
                              <div style={{ ...s.progressFill, width: `${pct}%` }} />
                            </div>
                            <span style={s.progressLabel}>{covered}/{total}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>

              {/* RIGHT — Fail Modes grid (read-only) */}
              <main style={s.main}>
                {activePoint ? (
                  <>
                    <div style={s.mainHeader}>
                      <div>
                        <h2 style={s.mainTitle}>{activePoint.name}</h2>
                        <p style={s.mainMeta}>
                          <span style={s.chip}>{withImage} con imagen</span>
                          {withoutImage > 0 && (
                            <span style={{ ...s.chip, ...s.chipGray }}>{withoutImage} sin imagen</span>
                          )}
                        </p>
                      </div>
                      <div style={s.mainHeaderRight}>
                        <div style={s.searchBox}>
                          <Icons.Search size={14} color="var(--color-text-secondary)" />
                          <input
                            style={s.searchInput}
                            placeholder="Buscar modo de falla..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                          />
                          {search && (
                            <button style={s.iconBtn} onClick={() => setSearch("")}>
                              <Icons.X size={13} />
                            </button>
                          )}
                        </div>
                        <button
                          style={s.btnManageMain}
                          onClick={() => setManagePoint(activePoint)}
                          title="Gestionar imágenes de este punto"
                        >
                          <Icons.Settings size={14} />
                          <span>Gestionar imágenes</span>
                        </button>
                      </div>
                    </div>

                    {filteredModes.length === 0 ? (
                      <div style={s.centerMsg}>
                        <p style={{ color: "var(--color-text-secondary)" }}>Sin resultados</p>
                      </div>
                    ) : (() => {
                        const n = filteredModes.length;
                        const isSmall = n <= 4;
                        const cols = n === 4 ? 2 : n;
                        const rows = n === 4 ? 2 : 1;
                        return (
                          <div style={{
                            ...s.grid,
                            gridTemplateColumns: isSmall ? `repeat(${cols}, 1fr)` : "repeat(auto-fill, minmax(220px, 1fr))",
                            ...(isSmall ? { gridTemplateRows: `repeat(${rows}, 1fr)`, overflowY: "hidden" } : {}),
                          }}>
                            {filteredModes.map(mode => (
                              <FailureModeCard
                                key={mode.id}
                                mode={mode}
                                onZoom={() => setViewImg(mode)}
                                fillMode={isSmall}
                                lang={lang}
                              />
                            ))}
                          </div>
                        );
                      })()
                    }
                  </>
                ) : (
                  <div style={s.centerMsg}>
                    <Icons.MousePointerClick size={30} color="var(--color-text-secondary)" />
                    <p style={{ color: "var(--color-text-secondary)" }}>
                      Selecciona un punto de inspección
                    </p>
                  </div>
                )}
              </main>
            </div>
          )}
        </>
      )}

      {/* Manage modal */}
      {managePoint && (
        <ManageModal
          point={managePoint}
          onClose={() => setManagePoint(null)}
          onSaved={refreshManagePoint}
        />
      )}

      {/* Lightbox */}
      {viewImg && viewImg.has_image && (
        <ImageViewer
          src={viewImg.image_data}
          name={viewImg.name}
          onClose={() => setViewImg(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: { margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--color-text-primary)" },
  subtitle: { margin: "3px 0 0", fontSize: "0.82rem", color: "var(--color-text-secondary)" },
  btnRefresh: {
    background: "transparent",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "7px 10px",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    backgroundColor: "#fff3cd",
    border: "1px solid #ffc107",
    borderRadius: "var(--radius-md)",
    fontSize: "0.83rem",
    color: "#856404",
  },
  centerMsg: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    color: "var(--color-text-secondary)",
  },
  // Business Unit tabs
  tabs: {
    display: "flex",
    gap: "4px",
    borderBottom: "2px solid var(--color-border)",
    paddingBottom: "0",
    flexWrap: "wrap",
  },
  tab: {
    padding: "8px 18px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    borderBottom: "2px solid transparent",
    marginBottom: "-2px",
    borderRadius: "var(--radius-md) var(--radius-md) 0 0",
    transition: "color 0.15s, border-color 0.15s",
  },
  tabActive: {
    color: "var(--color-primary)",
    borderBottomColor: "var(--color-primary)",
    backgroundColor: "var(--color-surface)",
  },
  // Layout
  layout: {
    display: "flex",
    gap: "1rem",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  // Aside
  aside: {
    width: "230px",
    flexShrink: 0,
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  asideLabel: {
    margin: 0,
    padding: "10px 12px 6px",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "var(--color-text-secondary)",
    borderBottom: "1px solid var(--color-border)",
  },
  asideEmpty: {
    margin: 0,
    padding: "12px",
    fontSize: "0.8rem",
    color: "var(--color-text-secondary)",
    fontStyle: "italic",
  },
  pointList: {
    listStyle: "none",
    margin: 0,
    padding: "6px",
    overflowY: "auto",
    flex: 1,
  },
  pointItem: {
    padding: "8px 10px",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    marginBottom: "2px",
  },
  pointItemActive: {
    backgroundColor: "var(--color-primary-light, rgba(var(--color-primary-rgb, 0,120,212), 0.08))",
    outline: "1px solid var(--color-primary)",
  },
  pointItemTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4px",
  },
  pointName: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--color-text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  btnManage: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
    padding: "2px",
    borderRadius: "var(--radius-sm)",
    flexShrink: 0,
  },
  pointProgress: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "4px",
  },
  progressBar: {
    flex: 1,
    height: "4px",
    backgroundColor: "var(--color-border)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "var(--color-primary)",
    borderRadius: "2px",
    transition: "width 0.3s ease",
  },
  progressLabel: {
    fontSize: "0.68rem",
    color: "var(--color-text-secondary)",
    flexShrink: 0,
  },
  // Main
  main: {
    flex: 1,
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  mainHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "12px 16px",
    borderBottom: "1px solid var(--color-border)",
    flexWrap: "wrap",
  },
  mainTitle: { margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text-primary)" },
  mainMeta: { margin: "4px 0 0", display: "flex", gap: "6px" },
  mainHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  chip: {
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "20px",
    backgroundColor: "var(--color-primary)",
    color: "#fff",
  },
  chipGray: {
    backgroundColor: "var(--color-border)",
    color: "var(--color-text-secondary)",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "5px 10px",
    background: "var(--color-bg-primary)",
    minWidth: "180px",
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "0.82rem",
    color: "var(--color-text-primary)",
  },
  btnManageMain: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    backgroundColor: "var(--color-primary)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    fontSize: "0.78rem",
    fontWeight: 600,
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: "10px",
    padding: "12px",
    overflowY: "auto",
    flex: 1,
  },
  // Card (solo lectura)
  card: {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    backgroundColor: "var(--color-bg-secondary, #f0f0f0)",
    position: "relative",
    aspectRatio: "4 / 3",
    minHeight: 0,
    transition: "box-shadow 0.15s, transform 0.15s",
  },
  cardImgEl: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transition: "transform 0.2s ease",
  },
  cardImgEmpty: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
  noImgText: { fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.0) 100%)",
    padding: "28px 10px 10px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.3,
    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
  },
  // Modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
  },
  modal: {
    backgroundColor: "var(--color-surface)",
    borderRadius: "var(--radius-lg, 12px)",
    width: "min(600px, 95vw)",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--color-border)",
  },
  modalSub: {
    margin: 0,
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
  },
  modalTitle: {
    margin: "4px 0 0",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--color-text-primary)",
  },
  modalBody: {
    overflowY: "auto",
    flex: 1,
    padding: "12px 20px",
  },
  // Mode list (inside modal)
  modeList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  modeRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 10px",
    borderRadius: "var(--radius-md)",
    borderBottom: "1px solid var(--color-border)",
  },
  rowThumb: {
    width: "44px",
    height: "44px",
    flexShrink: 0,
    borderRadius: "var(--radius-sm, 6px)",
    overflow: "hidden",
    backgroundColor: "var(--color-bg-secondary, #f0f0f0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rowThumbImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  rowName: {
    flex: 1,
    fontSize: "0.83rem",
    fontWeight: 600,
    color: "var(--color-text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
  },
  btnUpload: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 10px",
    backgroundColor: "var(--color-primary)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  btnRemove: {
    display: "flex",
    alignItems: "center",
    padding: "5px 8px",
    backgroundColor: "transparent",
    color: "#e53935",
    border: "1px solid #e53935",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
  },
  btnConfirmDel: {
    padding: "5px 8px",
    backgroundColor: "#e53935",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  btnCancelDel: {
    padding: "5px 8px",
    backgroundColor: "transparent",
    color: "var(--color-text-secondary)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
    padding: "2px",
  },
  // Lightbox
  lightbox: {
    backgroundColor: "var(--color-surface)",
    borderRadius: "var(--radius-lg, 12px)",
    maxWidth: "90vw",
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  lightboxHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--color-border)",
  },
  lightboxTitle: { fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text-primary)" },
  lightboxImg: { maxWidth: "85vw", maxHeight: "80vh", objectFit: "contain", display: "block" },
};
