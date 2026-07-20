import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSystemConfig, useUpdateSystemConfig, usePassRateTarget, useUpdatePassRateTarget } from "../hooks/useQWallSettings";
import type { SystemConfig } from "../types";

const BOOL_KEYS = ["camera_enabled", "scrap_enabled"];

function isBoolKey(key: string) { return BOOL_KEYS.includes(key); }

function toBool(v: string) { return v === "1" || v === "true"; }

export default function GeneralSettingsTab() {
  const { t } = useTranslation();
  const { data: configs = [], isLoading, error } = useSystemConfig();
  const updateConfig = useUpdateSystemConfig();

  const [local, setLocal] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (configs.length) {
      const map: Record<string, string> = {};
      configs.forEach((c: SystemConfig) => { map[c.config_key] = c.config_value; });
      setLocal(map);
      setDirty(new Set());
    }
  }, [configs]);

  const handleToggle = (key: string) => {
    const current = toBool(local[key]);
    const next    = current ? "0" : "1";
    setLocal(l => ({ ...l, [key]: next }));
    setDirty(d => new Set(d).add(key));
  };

  const handleTextChange = (key: string, value: string) => {
    setLocal(l => ({ ...l, [key]: value }));
    setDirty(d => new Set(d).add(key));
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const promises = Array.from(dirty).map(key => updateConfig.mutateAsync({ config_key: key, value: local[key] }));
      await Promise.all(promises);
      setDirty(new Set());
      setSaveMsg(t("qwallSettings.general.configSaved"));
    } catch {
      setSaveMsg(t("qwallSettings.messages.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // ── Pass Rate Target (Postgres — valor global único, sin historial) ────────
  const { data: passRateTarget, isLoading: targetLoading } = usePassRateTarget();
  const updateTarget = useUpdatePassRateTarget();
  const [targetLocal, setTargetLocal] = useState<string>("");
  const [targetDirty, setTargetDirty] = useState(false);
  const [targetMsg, setTargetMsg] = useState<string | null>(null);

  useEffect(() => {
    if (passRateTarget !== undefined) {
      setTargetLocal(String(passRateTarget));
      setTargetDirty(false);
    }
  }, [passRateTarget]);

  const handleSaveTarget = async () => {
    setTargetMsg(null);
    const value = parseFloat(targetLocal);
    if (Number.isNaN(value)) {
      setTargetMsg(t("qwallSettings.messages.saveError"));
      return;
    }
    try {
      await updateTarget.mutateAsync(value);
      setTargetDirty(false);
      setTargetMsg(t("qwallSettings.general.configSaved"));
    } catch {
      setTargetMsg(t("qwallSettings.messages.saveError"));
    }
  };

  if (isLoading) {
    return <div style={s.loading}>{t("qwallSettings.messages.loading")}</div>;
  }

  if (error) {
    return <div style={s.error}>{t("qwallSettings.messages.saveError")}</div>;
  }

  return (
    <div style={s.tab}>
      <div style={s.card}>
        <div style={s.row}>
          <div style={s.rowInfo}>
            <span style={s.rowLabel}>{t("qwallSettings.general.pass_rate_target")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="number"
                step="0.01"
                style={s.textInput}
                disabled={targetLoading}
                value={targetLocal}
                onChange={e => { setTargetLocal(e.target.value); setTargetDirty(true); }}
              />
              <span style={s.rowDesc}>%</span>
            </div>
            <button
              style={{ ...s.saveBtnSm, opacity: targetDirty ? 1 : 0.5 }}
              disabled={!targetDirty || updateTarget.isPending}
              onClick={handleSaveTarget}
            >
              {updateTarget.isPending ? t("qwallSettings.buttons.saving") : t("qwallSettings.general.saveConfig")}
            </button>
          </div>
        </div>
        {targetMsg && (
          <div style={{ padding: "0 1.25rem 0.75rem" }}>
            <span style={{ ...s.msg, color: targetMsg === t("qwallSettings.general.configSaved") ? "var(--color-running)" : "var(--color-stopped)" }}>
              {targetMsg}
            </span>
          </div>
        )}
      </div>

      <div style={s.card}>
        {configs.map((c: SystemConfig) => (
          <div key={c.config_key} style={s.row}>
            <div style={s.rowInfo}>
              <span style={s.rowLabel}>{t(`qwallSettings.general.${c.config_key}`, { defaultValue: c.config_key })}</span>
            </div>
            {isBoolKey(c.config_key) ? (
              <button
                style={{ ...s.toggle, ...(toBool(local[c.config_key]) ? s.toggleOn : s.toggleOff) }}
                onClick={() => handleToggle(c.config_key)}
                type="button"
              >
                <span style={{
                  ...s.toggleThumb,
                  left: toBool(local[c.config_key]) ? TOGGLE_W - THUMB - 3 : 3,
                }} />
              </button>
            ) : (
              <input
                style={s.textInput}
                value={local[c.config_key] ?? ""}
                onChange={e => handleTextChange(c.config_key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <div style={s.footer}>
        {saveMsg && (
          <span style={{ ...s.msg, color: saveMsg === t("qwallSettings.general.configSaved") ? "var(--color-running)" : "var(--color-stopped)" }}>
            {saveMsg}
          </span>
        )}
        <button
          style={{ ...s.saveBtn, opacity: dirty.size === 0 ? 0.5 : 1 }}
          disabled={dirty.size === 0 || saving}
          onClick={handleSave}
        >
          {saving ? t("qwallSettings.buttons.saving") : t("qwallSettings.general.saveConfig")}
        </button>
      </div>
    </div>
  );
}

const TOGGLE_W = 44;
const TOGGLE_H = 24;
const THUMB    = 18;

const s: Record<string, React.CSSProperties> = {
  tab:       { display: "flex", flexDirection: "column", gap: "1.25rem" },
  loading:   { color: "var(--color-text-secondary)", fontSize: "0.875rem" },
  error:     { color: "var(--color-stopped)", fontSize: "0.875rem" },
  card:      { border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  row:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid var(--color-border)", gap: "1rem" },
  rowInfo:   { display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1 },
  rowLabel:  { fontSize: "0.9rem", fontWeight: "600", color: "var(--color-text-primary)" },
  rowDesc:   { fontSize: "0.8rem", color: "var(--color-text-secondary)" },
  toggle:    {
    position: "relative", width: TOGGLE_W, height: TOGGLE_H,
    borderRadius: 99, border: "none", cursor: "pointer",
    flexShrink: 0, transition: "background-color 0.2s",
  },
  toggleOn:  { backgroundColor: "var(--color-primary)" },
  toggleOff: { backgroundColor: "var(--color-border)" },
  toggleThumb: {
    position: "absolute", top: (TOGGLE_H - THUMB) / 2,
    width: THUMB, height: THUMB, borderRadius: "50%",
    backgroundColor: "#fff", transition: "left 0.2s",
  },
  textInput: {
    padding: "0.45rem 0.65rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", fontSize: "0.875rem",
    color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)",
    width: "200px",
  },
  footer:    { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "1rem" },
  msg:       { fontSize: "0.85rem" },
  saveBtn:   {
    padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", border: "none",
    backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer",
    fontSize: "0.875rem", fontWeight: "600",
  },
  saveBtnSm: {
    padding: "0.4rem 0.9rem", borderRadius: "var(--radius-md)", border: "none",
    backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer",
    fontSize: "0.8rem", fontWeight: "600",
  },
};
