import { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCreateScanRule, useUpdateScanRule, useScanRule } from "../hooks/useQWallSettings";
import type { PartNumber, PartNumberScanRule, ScanField, ExtractionMode } from "../types";
import ScanFieldForm from "./ScanFieldForm";

const VOLVO_BU_ID = 1;

function emptyField(scan_index: number, sequence_order: number): ScanField {
  return {
    scan_index,
    extraction_mode:  "completo" as ExtractionMode,
    field_target:     "frameSN",
    separator:        "ninguno",
    separator_custom: "",
    value_position:   "completo",
    segment_index:    null,
    fixed_length:     null,
    prefix_value:     "",
    display_label:    "",
    sequence_order,
  };
}

// ─── props ────────────────────────────────────────────────────────────────────

interface Props {
  mode:         "create" | "edit";
  partNumber?:  PartNumber;          // header display + pn_id for create
  ruleId?:      number;              // edit: load full rule
  onClose:      () => void;
  onSuccess?:   () => void;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function ScanRuleModal({ mode, partNumber, ruleId, onClose, onSuccess }: Props) {
  const { t }  = useTranslation();
  const create = useCreateScanRule();
  const update = useUpdateScanRule();

  const { data: loadedRule, isLoading: ruleLoading } = useScanRule(ruleId ?? 0);

  // Header display values — available immediately in create mode, after load in edit mode
  const displaySsiPn  = loadedRule?.ssi_pn  ?? partNumber?.ssiPN   ?? "";
  const displayBuName = loadedRule?.bu_name  ?? partNumber?.bu_name ?? "";
  const displayBuId   = loadedRule?.bu_id    ?? partNumber?.bu_id   ?? 0;

  // Form state
  const [scanCount,     setScanCount]     = useState(1);
  const [requiresMatch, setRequiresMatch] = useState(false);
  const [notes,         setNotes]         = useState("");
  const [fieldGroups,   setFieldGroups]   = useState<ScanField[][]>([[]]);
  const [saving,        setSaving]        = useState(false);
  const [formError,     setFormError]     = useState<string | null>(null);
  const [initialized,   setInitialized]   = useState(() => mode === "create");

  // Populate form when edit rule loads
  useEffect(() => {
    if (mode === "create") { setInitialized(true); return; }
    if (!loadedRule || initialized) return;

    setScanCount(loadedRule.scan_count);
    setRequiresMatch(loadedRule.requires_match);
    setNotes(loadedRule.notes ?? "");

    const count  = loadedRule.scan_count;
    const groups: ScanField[][] = Array.from({ length: count }, () => []);
    (loadedRule.scan_fields ?? []).forEach(f => {
      if (f.scan_index < count) groups[f.scan_index].push(f);
    });
    setFieldGroups(groups);
    setInitialized(true);
  }, [loadedRule, mode, initialized]);

  // Sync field groups array length with scanCount (after init)
  useEffect(() => {
    if (!initialized) return;
    setFieldGroups(prev =>
      Array.from({ length: scanCount }, (_, i) => prev[i] ?? [])
    );
  }, [scanCount, initialized]);

  // ── field group helpers ────────────────────────────────────────────────────

  const addField = (scanIdx: number) =>
    setFieldGroups(prev => {
      const next = prev.map(g => [...g]);
      next[scanIdx] = [...next[scanIdx], emptyField(scanIdx, next[scanIdx].length)];
      return next;
    });

  const removeField = (scanIdx: number, seqIdx: number) =>
    setFieldGroups(prev => {
      const next = prev.map(g => [...g]);
      next[scanIdx] = next[scanIdx].filter((_, i) => i !== seqIdx);
      return next;
    });

  const updateField = (scanIdx: number, seqIdx: number, updated: ScanField) =>
    setFieldGroups(prev => {
      const next = prev.map(g => [...g]);
      next[scanIdx] = next[scanIdx].map((f, i) => i === seqIdx ? updated : f);
      return next;
    });

  // ── submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const allFields: ScanField[] = fieldGroups.flatMap((group, scanIdx) =>
      group.map((f, seqIdx) => ({ ...f, scan_index: scanIdx, sequence_order: seqIdx }))
    );

    const pnId      = loadedRule?.pn_id ?? partNumber!.pn_id;
    const ssiPn     = displaySsiPn;
    const buId      = displayBuId;
    const buName    = displayBuName;

    const payload = {
      pn_id: pnId, ssi_pn: ssiPn, bu_id: buId, bu_name: buName,
      scan_count: scanCount, requires_match: requiresMatch, notes,
      is_active: loadedRule?.is_active ?? true,
      scan_fields: allFields,
    };

    try {
      if (mode === "edit" && ruleId) {
        await update.mutateAsync({ id: ruleId, data: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : JSON.stringify(detail) ?? t("qwallSettings.scanRules.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // ── skeleton while edit rule loads ─────────────────────────────────────────

  if (mode === "edit" && (ruleLoading || !initialized)) {
    return (
      <div style={s.overlay}>
        <div style={s.modal}>
          <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: "2rem", backgroundColor: "var(--color-border)", borderRadius: "var(--radius-sm)", animationName: "pulse", animationDuration: "1.5s", animationIterationCount: "infinite" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h3 style={s.title}>
              {mode === "edit"
                ? t("qwallSettings.scanRules.editTitle")
                : t("qwallSettings.scanRules.createTitle")}
            </h3>
            <div style={s.subtitle}>
              <span style={s.pnChip}>{displaySsiPn}</span>
              <span style={s.buChip}>{displayBuName}</span>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><Icons.X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={s.body}>

          {/* ── Section 1: General ──────────────────────────────────── */}
          <p style={s.sectionLabel}>{t("qwallSettings.scanRules.sectionGeneral")}</p>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>{t("qwallSettings.scanRules.scanCount")}</label>
              <input
                type="number" min={1} max={5}
                style={{ ...s.input, width: "80px" }}
                value={scanCount}
                onChange={e => setScanCount(Math.max(1, Math.min(5, Number(e.target.value))))}
              />
            </div>
            {displayBuId === VOLVO_BU_ID && (
              <div style={s.checkField}>
                <input
                  type="checkbox" id="reqMatch"
                  checked={requiresMatch}
                  onChange={e => setRequiresMatch(e.target.checked)}
                />
                <label htmlFor="reqMatch" style={s.checkLabel}>
                  {t("qwallSettings.scanRules.requiresMatch")}
                </label>
              </div>
            )}
          </div>

          <div style={s.field}>
            <label style={s.label}>{t("qwallSettings.scanRules.notes")}</label>
            <textarea
              style={s.textarea} value={notes} rows={2}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* ── Section 2: Scan field groups ────────────────────────── */}
          <p style={s.sectionLabel}>{t("qwallSettings.scanRules.sectionFields")}</p>

          {fieldGroups.map((group, scanIdx) => (
            <div key={scanIdx} style={s.scanGroup}>
              <div style={s.scanGroupHeader}>
                <Icons.ScanLine size={14} />
                <span>{t("qwallSettings.scanRules.scanGroup")} {scanIdx + 1}</span>
              </div>

              {group.map((field, seqIdx) => (
                <ScanFieldForm
                  key={seqIdx}
                  field={field}
                  onChange={updated => updateField(scanIdx, seqIdx, updated)}
                  onRemove={() => removeField(scanIdx, seqIdx)}
                />
              ))}

              <button
                type="button"
                style={s.addFieldBtn}
                onClick={() => addField(scanIdx)}
              >
                <Icons.Plus size={13} />
                {t("qwallSettings.scanRules.fieldForm.addField")}
              </button>
            </div>
          ))}

          {formError && <p style={s.errorMsg}>{formError}</p>}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div style={s.footer}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>
              {t("qwallSettings.buttons.cancel")}
            </button>
            <button type="submit" style={s.saveBtn} disabled={saving}>
              {saving ? t("qwallSettings.buttons.saving") : t("qwallSettings.buttons.save")}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay:         { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" },
  modal:           { backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "740px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", overflowY: "auto" },
  header:          { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)", flexShrink: 0 },
  title:           { fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  subtitle:        { display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.3rem" },
  pnChip:          { fontSize: "0.78rem", fontWeight: "700", fontFamily: "monospace", backgroundColor: "rgba(59,130,246,0.12)", color: "var(--color-primary)", padding: "0.15rem 0.5rem", borderRadius: "99px" },
  buChip:          { fontSize: "0.78rem", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", padding: "0.15rem 0.5rem", borderRadius: "99px", border: "1px solid var(--color-border)" },
  closeBtn:        { background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex", flexShrink: 0 },
  body:            { padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" },
  sectionLabel:    { fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, paddingTop: "0.25rem" },
  row:             { display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" },
  field:           { display: "flex", flexDirection: "column", gap: "0.3rem" },
  label:           { fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-primary)" },
  input:           { padding: "0.5rem 0.65rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  textarea:        { padding: "0.5rem 0.65rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", resize: "vertical" },
  checkField:      { display: "flex", alignItems: "center", gap: "0.5rem" },
  checkLabel:      { fontSize: "0.875rem", color: "var(--color-text-primary)" },
  scanGroup:       { border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem", backgroundColor: "var(--color-bg)" },
  scanGroupHeader: { display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: "700", color: "var(--color-text-primary)" },
  addFieldBtn:     { display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "var(--color-primary)", background: "none", border: "1px dashed var(--color-primary)", borderRadius: "var(--radius-sm)", padding: "0.3rem 0.7rem", cursor: "pointer", alignSelf: "flex-start" },
  errorMsg:        { color: "var(--color-stopped)", fontSize: "0.82rem", padding: "0.4rem 0.6rem", backgroundColor: "rgba(220,38,38,0.08)", borderRadius: "var(--radius-sm)" },
  footer:          { display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.25rem" },
  cancelBtn:       { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-secondary)" },
  saveBtn:         { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "none", backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
};
