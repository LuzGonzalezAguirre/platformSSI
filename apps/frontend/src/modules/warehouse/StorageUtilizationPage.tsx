import { useEffect, useRef, useState } from "react";
import { Maximize2, RotateCw, Save, Settings2 } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

type PalletType = "euro" | "standard";
type Level = { level: number; pallet_count: number; utilization: number };
type Rack = {
  number: number; pallet_type: PalletType; levels: Level[];
  x: number | null; y: number | null; width: number; height: number; rotation: number;
};
type Payload = { designer_enabled: boolean; racks: Rack[] };
type Patch = Partial<Pick<Rack, "pallet_type" | "x" | "y" | "width" | "height" | "rotation">> & {
  number?: number; levels?: { level: number; pallet_count: number }[]; designer_enabled?: boolean;
};

const endpoint = "/api/v1/warehouse/storage-utilization/";
const cap = (type: PalletType) => type === "standard" ? 2 : 3;
const rackLabel = (n: number) => `TJR${n}`;
const locationLabel = (n: number, level: number) => `TJR${n}-${String(level).padStart(2, "0")}`;

function requestHeaders() {
  const token = localStorage.getItem("mes_access_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function callApi(patch?: Patch): Promise<Payload> {
  const response = await fetch(endpoint, {
    method: patch ? "PATCH" : "GET",
    headers: requestHeaders(),
    ...(patch ? { body: JSON.stringify(patch) } : {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

const buttonStyle: React.CSSProperties = {
  padding: "0.55rem 0.85rem", borderRadius: 9, border: "1px solid var(--color-border)",
  background: "var(--color-surface)", color: "var(--color-text-primary)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600,
};

export default function StorageUtilizationPage() {
  const canEdit = useAuthStore((state) => state.hasPermission("warehouse", "edit"));
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number>(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [designer, setDesigner] = useState(false);
  const [draft, setDraft] = useState<Rack | null>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ number: number; offsetX: number; offsetY: number } | null>(null);

  const reload = async () => {
    try { setData(await callApi()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load warehouse."); }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    if (!data) return;
    setDraft(data.racks.find((rack) => rack.number === selected) ?? null);
  }, [selected, data]);

  const racks = data?.racks ?? [];
  const slots = racks.flatMap((rack) => rack.levels.map((level) => ({
    ...level, capacity: cap(rack.pallet_type),
  })));
  const used = slots.reduce((sum, slot) => sum + slot.utilization, 0);
  const utilization = slots.length ? used / slots.length : 0;
  const placed = racks.filter((rack) => rack.x !== null && rack.y !== null);
  const rack = racks.find((item) => item.number === selected);
  const hasPlaced = placed.length > 0;

  const save = async (patch: Patch) => {
    if (!canEdit) return;
    setBusy(true);
    try { const updated = await callApi(patch); setData(updated); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save changes."); }
    finally { setBusy(false); }
  };

  const changeType = (type: PalletType) => {
    if (!draft) return;
    const limit = cap(type);
    setDraft({ ...draft, pallet_type: type,
      levels: draft.levels.map((item) => ({ ...item, pallet_count: Math.min(item.pallet_count, limit) })) });
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, item: Rack) => {
    if (!designer || !canEdit || !floorRef.current) return;
    const rect = floorRef.current.getBoundingClientRect();
    dragRef.current = {
      number: item.number,
      offsetX: (event.clientX - rect.left) / rect.width * 100 - (item.x ?? 0),
      offsetY: (event.clientY - rect.top) / rect.height * 100 - (item.y ?? 0),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(item.number);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !floorRef.current || !data) return;
    const rect = floorRef.current.getBoundingClientRect();
    const current = data.racks.find((item) => item.number === dragRef.current?.number);
    if (!current) return;
    const x = Math.max(0, Math.min(100 - current.width, (event.clientX - rect.left) / rect.width * 100 - dragRef.current.offsetX));
    const y = Math.max(0, Math.min(100 - current.height, (event.clientY - rect.top) / rect.height * 100 - dragRef.current.offsetY));
    setData({ ...data, racks: data.racks.map((item) => item.number === current.number ? { ...item, x, y } : item) });
  };

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current;
    dragRef.current = null;
    if (!dragging) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
    const item = data?.racks.find((r) => r.number === dragging.number);
    if (item) void save({ number: item.number, x: item.x, y: item.y });
  };

  const unplaced = racks.filter((item) => item.x === null || item.y === null);
  const selectedRack = draft && draft.number === selected ? draft : rack;
  const percent = (item: Rack) => item.levels.reduce((sum, level) => sum + level.pallet_count / cap(item.pallet_type) * 100, 0) / 4;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "calc(100vh - 150px)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", color: "var(--color-text-primary)" }}>WH Storage Utilization</h1>
          <p style={{ margin: "5px 0 0", color: "var(--color-text-secondary)", fontSize: 13 }}>Warehouse occupancy by location and pallet type</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={buttonStyle} onClick={() => floorRef.current?.requestFullscreen?.()}><Maximize2 size={16} /> Full screen</button>
          {canEdit && <button style={buttonStyle} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={16} /> Settings</button>}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
        {[
          ["Total utilization", `${utilization.toFixed(2)}%`],
          ["Storage locations", String(slots.length)],
          ["Racks", String(racks.length)],
          ["Racks on layout", String(placed.length)],
        ].map(([label, value]) => (
          <div key={label} style={{ ...panel, padding: "13px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 5 }}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div role="alert" style={{ padding: 12, background: "#fee2e2", color: "#991b1b", borderRadius: 8 }}>{error}</div>}
      {!data && !error && <p>Loading warehouse...</p>}

      {settingsOpen && canEdit && data && (
        <section style={{ ...panel, padding: 16 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Warehouse settings</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <input type="checkbox" checked={data.designer_enabled}
              onChange={(e) => void save({ designer_enabled: e.target.checked })} disabled={busy} />
            Enable warehouse layout designer
          </label>
          {data.designer_enabled && (
            <button style={buttonStyle} onClick={() => setDesigner((value) => !value)}>
              {designer ? "Finish editing layout" : "Edit rack layout"}
            </button>
          )}
          <p style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>
            Rack coordinates are saved on the server. Unplaced racks remain accessible in the list below.
          </p>
        </section>
      )}

      {data && (
        <div ref={floorRef} style={{ ...panel, padding: 16, width: "100%", minHeight: "min(70vh, 760px)", boxSizing: "border-box", background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <strong style={{ color: "var(--color-text-primary)" }}>Warehouse layout</strong>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{designer ? "Drag racks to position them" : "Select a rack to manage utilization"}</span>
          </div>
          <div style={{ position: "relative", flex: 1, minHeight: 420, overflow: "hidden", border: "1px solid var(--color-border)", borderRadius: 12,
            backgroundColor: "var(--color-bg)", backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)", backgroundSize: "5% 5%" }}>
            {!hasPlaced && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center", padding: 20, pointerEvents: "none" }}>
                <strong style={{ fontSize: 20, color: "var(--color-text-primary)" }}>Warehouse layout not configured</strong>
                <span style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>Activate the designer in Settings and place racks from the rack list.</span>
              </div>
            )}
            {placed.map((item) => (
              <div key={item.number} role="button" tabIndex={0} aria-label={rackLabel(item.number)}
                onKeyDown={(event) => { if (event.key === "Enter") setSelected(item.number); }}
                onPointerDown={(event) => startDrag(event, item)} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}
                onClick={() => setSelected(item.number)}
                style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, height: `${item.height}%`,
                  transform: `rotate(${item.rotation}deg)`, borderRadius: 8, border: selected === item.number ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: percent(item) >= 99.9 ? "#fee2e2" : percent(item) > 0 ? "#fef3c7" : "#dcfce7",
                  color: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                  cursor: designer ? "grab" : "pointer", userSelect: "none", touchAction: "none", boxSizing: "border-box", fontSize: 12 }}>
                <strong>{rackLabel(item.number)}</strong><span>{Math.round(percent(item))}%</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--color-text-secondary)" }}>
            <span>Green: Empty</span><span>Yellow: Partial</span><span>Red: Full</span>
            <span style={{ marginLeft: "auto" }}>Placed: {placed.length} / {racks.length}</span>
          </div>
        </div>
      )}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          <section style={{ ...panel, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Rack selection</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(69px, 1fr))", gap: 7, maxHeight: 310, overflowY: "auto" }}>
              {racks.map((item) => (
                <button key={item.number} onClick={() => setSelected(item.number)}
                  style={{ ...buttonStyle, justifyContent: "center", padding: "10px 5px", borderColor: selected === item.number ? "var(--color-primary)" : "var(--color-border)",
                    background: selected === item.number ? "var(--color-bg)" : "var(--color-surface)", fontSize: 12 }}>
                  {rackLabel(item.number)}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Unplaced racks: {unplaced.length}. All 55 racks remain available independently of the visual layout.</p>
          </section>

          {selectedRack && (
            <section style={{ ...panel, padding: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>{rackLabel(selectedRack.number)} · {percent(selectedRack).toFixed(1)}%</h2>
              <label style={fieldLabel}>Pallet type</label>
              <select disabled={!canEdit || busy} value={selectedRack.pallet_type}
                onChange={(event) => changeType(event.target.value as PalletType)} style={field}>
                <option value="euro">Euro pallet — 3 per location</option>
                <option value="standard">Standard pallet — 2 per location</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
                {selectedRack.levels.map((level) => (
                  <label key={level.level} style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
                    {locationLabel(selectedRack.number, level.level)}
                    <select style={{ ...field, marginTop: 5 }} disabled={!canEdit || busy} value={level.pallet_count}
                      onChange={(event) => setDraft({ ...selectedRack,
                        levels: selectedRack.levels.map((item) => item.level === level.level ? { ...item, pallet_count: Number(event.target.value) } : item),
                      })}>
                      {Array.from({ length: cap(selectedRack.pallet_type) + 1 }, (_, count) => (
                        <option key={count} value={count}>{count} / {cap(selectedRack.pallet_type)} — {(count / cap(selectedRack.pallet_type) * 100).toFixed(0)}%</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {designer && canEdit && (
                <div style={{ marginTop: 14 }}>
                  <label style={fieldLabel}>Position (X / Y) and size (% of canvas)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 7 }}>
                    {(["x", "y", "width", "height"] as const).map((key) => (
                      <label key={key} style={{ fontSize: 12 }}>{key.toUpperCase()}
                        <input type="number" min={0} max={100} step={0.5} style={{ ...field, width: "100%", boxSizing: "border-box" }}
                          value={selectedRack[key] ?? ""} onChange={(event) => setDraft({ ...selectedRack, [key]: event.target.value === "" ? null : Number(event.target.value) })} />
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button style={buttonStyle} onClick={() => setDraft({ ...selectedRack, rotation: (selectedRack.rotation + 90) % 360 })}><RotateCw size={14} /> Rotate</button>
                    <button style={buttonStyle} onClick={() => void save({ number: selectedRack.number, x: null, y: null })}>Remove from layout</button>
                  </div>
                </div>
              )}
              {canEdit && (
                <button disabled={busy} style={{ ...buttonStyle, marginTop: 16, background: "var(--color-primary)", color: "#fff" }}
                  onClick={() => void save({ number: selectedRack.number, pallet_type: selectedRack.pallet_type,
                    levels: selectedRack.levels.map((level) => ({ level: level.level, pallet_count: level.pallet_count })),
                    ...(designer ? { x: selectedRack.x, y: selectedRack.y, width: selectedRack.width, height: selectedRack.height, rotation: selectedRack.rotation } : {}),
                  })}>
                  <Save size={15} /> {busy ? "Saving..." : "Save changes"}
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12,
  boxSizing: "border-box",
};
const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: "var(--color-text-secondary)" };
const field: React.CSSProperties = { display: "block", width: "100%", padding: "8px", borderRadius: 8, background: "var(--color-bg)",
  border: "1px solid var(--color-border)", color: "var(--color-text-primary)" };
