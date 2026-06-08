import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react";
import type { ScanField, ExtractionMode, Separator, FieldTarget } from "../types";

// ─── preview builder ──────────────────────────────────────────────────────────

const SEP_CHARS: Record<string, string> = {
  espacio: " ", apostrofe: "'", guion: "-",
  guion_bajo: "_", pipe: "|",
};

function buildPreview(f: ScanField): string {
  const { t } = { t: (k: string) => k }; // not used here; labels handled in component
  const filler  = f.fixed_length ? "X".repeat(f.fixed_length) : "XXXXXXXXXX";
  const prefix  = f.prefix_value || "PREFIJO";
  const sepChar = f.separator === "custom"
    ? f.separator_custom
    : SEP_CHARS[f.separator] ?? "";

  switch (f.extraction_mode) {
    case "completo":
      return filler;

    case "por_separador":
      if (!sepChar || !f.value_position || f.value_position === "completo") return "";
      if (f.value_position === "antes")   return `${filler}${sepChar}RESTO`;
      if (f.value_position === "despues") return `${prefix}${sepChar}${filler}`;
      return "";

    case "pegado_longitud":
      if (!f.fixed_length) return "";
      return `${prefix}${filler}`;

    case "segmento": {
      if (!sepChar || f.segment_index === null) return "";
      const parts = ["SEG0", "SEG1", "SEG2"];
      const idx = Math.min(f.segment_index, 2);
      parts[idx] = filler;
      return parts.join(sepChar);
    }
  }
}

// ─── defaults when switching extraction_mode ──────────────────────────────────

function applyModeDefaults(f: ScanField, mode: ExtractionMode): ScanField {
  switch (mode) {
    case "completo":
      return { ...f, extraction_mode: mode, separator: "ninguno", value_position: "completo", segment_index: null };
    case "por_separador":
      return {
        ...f, extraction_mode: mode,
        separator: f.separator === "ninguno" ? "espacio" : f.separator,
        value_position: "antes",
        segment_index: null,
      };
    case "pegado_longitud":
      return { ...f, extraction_mode: mode, separator: "ninguno", value_position: "completo", segment_index: null };
    case "segmento":
      return {
        ...f, extraction_mode: mode,
        separator: f.separator === "ninguno" ? "guion" : f.separator,
        value_position: "segmento",
        segment_index: f.segment_index ?? 0,
      };
  }
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  field:    ScanField;
  onChange: (field: ScanField) => void;
  onRemove: () => void;
}

export default function ScanFieldForm({ field, onChange, onRemove }: Props) {
  const { t } = useTranslation();

  const upd = (patch: Partial<ScanField>) => onChange({ ...field, ...patch });

  const FIELD_TARGETS: FieldTarget[] = ["frameSN", "volvoSerialNumber", "descartado"];
  const EXTRACTION_MODES: ExtractionMode[] = ["completo", "por_separador", "pegado_longitud", "segmento"];
  const SEPARATORS_WITH_SEP: Separator[] = ["espacio", "apostrofe", "guion", "guion_bajo", "pipe", "custom"];
  const SEPARATORS_ALL: Separator[]      = [...SEPARATORS_WITH_SEP, "ninguno"];

  const preview   = buildPreview(field);
  const needsSep  = field.extraction_mode === "por_separador" || field.extraction_mode === "segmento";
  const isIncomplete =
    (field.extraction_mode === "pegado_longitud" && (!field.fixed_length || !field.prefix_value)) ||
    (field.extraction_mode === "segmento" && (field.segment_index === null || !field.separator || field.separator === "ninguno"));

  return (
    <div style={s.card}>
      {/* ── Row 1: always visible ─────────────────────────────────── */}
      <div style={s.row}>
        {/* display_label */}
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.label}>{t("qwallSettings.scanRules.displayLabel")}</label>
          <input
            style={s.input}
            value={field.display_label}
            placeholder="ej: Serial SSI"
            onChange={e => upd({ display_label: e.target.value })}
          />
        </div>

        {/* field_target */}
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.label}>{t("qwallSettings.scanRules.fieldTarget")}</label>
          <select
            style={s.input}
            value={field.field_target}
            onChange={e => upd({ field_target: e.target.value as FieldTarget })}
          >
            {FIELD_TARGETS.map(v => (
              <option key={v} value={v}>{t(`qwallSettings.scanRules.fieldTargets.${v}`)}</option>
            ))}
          </select>
        </div>

        {/* extraction_mode */}
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.extractionMode")}</label>
          <select
            style={s.input}
            value={field.extraction_mode}
            onChange={e => onChange(applyModeDefaults(field, e.target.value as ExtractionMode))}
          >
            {EXTRACTION_MODES.map(v => (
              <option key={v} value={v}>{t(`qwallSettings.scanRules.extractionModes.${v}`)}</option>
            ))}
          </select>
        </div>

        <button type="button" style={s.removeBtn} onClick={onRemove} title={t("qwallSettings.scanRules.fieldForm.removeField")}>
          <Icons.X size={13} />
        </button>
      </div>

      {/* ── Row 2: conditional ────────────────────────────────────── */}
      <div style={s.row}>
        {/* completo */}
        {field.extraction_mode === "completo" && (
          <div style={s.field}>
            <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.fixedLength")}</label>
            <input
              type="number" min={1} style={{ ...s.input, width: "90px" }}
              value={field.fixed_length ?? ""}
              placeholder="—"
              onChange={e => upd({ fixed_length: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        )}

        {/* por_separador */}
        {field.extraction_mode === "por_separador" && (
          <>
            <div style={s.field}>
              <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.separator")}</label>
              <select
                style={s.input}
                value={field.separator}
                onChange={e => upd({ separator: e.target.value as Separator })}
              >
                {SEPARATORS_WITH_SEP.map(v => (
                  <option key={v} value={v}>{t(`qwallSettings.scanRules.separators.${v}`)}</option>
                ))}
              </select>
            </div>
            {field.separator === "custom" && (
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.customSeparator")}</label>
                <input
                  style={{ ...s.input, width: "70px" }} maxLength={10}
                  value={field.separator_custom}
                  onChange={e => upd({ separator_custom: e.target.value })}
                />
              </div>
            )}
            <div style={s.field}>
              <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.valuePosition")}</label>
              <select
                style={s.input}
                value={field.value_position}
                onChange={e => upd({ value_position: e.target.value as "antes" | "despues" })}
              >
                <option value="antes">{t("qwallSettings.scanRules.valuePositions.antes")}</option>
                <option value="despues">{t("qwallSettings.scanRules.valuePositions.despues")}</option>
              </select>
            </div>
            <div style={{ ...s.field, flex: 2 }}>
              <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.knownPrefix")}</label>
              <input
                style={s.input} value={field.prefix_value} placeholder="—"
                onChange={e => upd({ prefix_value: e.target.value })}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.fixedLength")}</label>
              <input
                type="number" min={1} style={{ ...s.input, width: "90px" }}
                value={field.fixed_length ?? ""} placeholder="—"
                onChange={e => upd({ fixed_length: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </>
        )}

        {/* pegado_longitud */}
        {field.extraction_mode === "pegado_longitud" && (
          <>
            <div style={{ ...s.field, flex: 2 }}>
              <label style={s.label}>
                {t("qwallSettings.scanRules.fieldForm.knownPrefix")}
                <span style={s.required}>*</span>
              </label>
              <input
                style={s.input} value={field.prefix_value}
                placeholder="ej: 35482.2"
                onChange={e => upd({ prefix_value: e.target.value })}
              />
              <span style={s.hint}>{t("qwallSettings.scanRules.fieldForm.prefixHint")}</span>
            </div>
            <div style={s.field}>
              <label style={s.label}>
                {t("qwallSettings.scanRules.fieldForm.fixedLength")}
                <span style={s.required}>*</span>
              </label>
              <input
                type="number" min={1} style={{ ...s.input, width: "90px" }}
                value={field.fixed_length ?? ""}
                onChange={e => upd({ fixed_length: e.target.value ? Number(e.target.value) : null })}
              />
              <span style={s.hint}>{t("qwallSettings.scanRules.fieldForm.fixedLengthHint")}</span>
            </div>
          </>
        )}

        {/* segmento */}
        {field.extraction_mode === "segmento" && (
          <>
            <div style={s.field}>
              <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.separator")}</label>
              <select
                style={s.input}
                value={field.separator}
                onChange={e => upd({ separator: e.target.value as Separator })}
              >
                {SEPARATORS_WITH_SEP.map(v => (
                  <option key={v} value={v}>{t(`qwallSettings.scanRules.separators.${v}`)}</option>
                ))}
              </select>
            </div>
            {field.separator === "custom" && (
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.customSeparator")}</label>
                <input
                  style={{ ...s.input, width: "70px" }} maxLength={10}
                  value={field.separator_custom}
                  onChange={e => upd({ separator_custom: e.target.value })}
                />
              </div>
            )}
            <div style={s.field}>
              <label style={s.label}>
                {t("qwallSettings.scanRules.fieldForm.segmentIndex")}
                <span style={s.required}>*</span>
              </label>
              <input
                type="number" min={0} style={{ ...s.input, width: "80px" }}
                value={field.segment_index ?? ""}
                onChange={e => upd({ segment_index: e.target.value !== "" ? Number(e.target.value) : null })}
              />
              <span style={s.hint}>{t("qwallSettings.scanRules.fieldForm.segmentIndexHint")}</span>
            </div>
            <div style={s.field}>
              <label style={s.label}>{t("qwallSettings.scanRules.fieldForm.fixedLength")}</label>
              <input
                type="number" min={1} style={{ ...s.input, width: "90px" }}
                value={field.fixed_length ?? ""} placeholder="—"
                onChange={e => upd({ fixed_length: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Preview ───────────────────────────────────────────────── */}
      <div style={s.previewRow}>
        <span style={s.previewLabel}>{t("qwallSettings.scanRules.fieldForm.preview")}:</span>
        {isIncomplete || !preview ? (
          <span style={s.previewIncomplete}>
            {t("qwallSettings.scanRules.fieldForm.previewIncomplete")}
          </span>
        ) : (
          <code style={s.previewCode}>{preview}</code>
        )}
      </div>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card:        { border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.65rem", display: "flex", flexDirection: "column", gap: "0.5rem", backgroundColor: "var(--color-surface)" },
  row:         { display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" },
  field:       { display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: "100px" },
  label:       { fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", whiteSpace: "nowrap" },
  input:       { padding: "0.4rem 0.55rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontSize: "0.82rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", width: "100%", boxSizing: "border-box" as const },
  removeBtn:   { display: "flex", alignItems: "center", padding: "0.3rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-stopped)", flexShrink: 0, marginTop: "1.35rem" },
  hint:        { fontSize: "0.7rem", color: "var(--color-text-secondary)", fontStyle: "italic" },
  required:    { color: "var(--color-stopped)", marginLeft: "2px" },
  previewRow:  { display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "0.1rem" },
  previewLabel:{ fontSize: "0.72rem", color: "var(--color-text-secondary)", fontWeight: "600" },
  previewCode: { fontFamily: "monospace", fontSize: "0.8rem", backgroundColor: "rgba(59,130,246,0.07)", border: "1px solid var(--color-border)", padding: "0.15rem 0.5rem", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)" },
  previewIncomplete: { fontSize: "0.75rem", color: "var(--color-text-secondary)", fontStyle: "italic" },
};
