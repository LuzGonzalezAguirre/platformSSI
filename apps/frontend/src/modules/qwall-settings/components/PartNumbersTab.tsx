import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  usePartNumbers, useBusinessUnits,
  useCreatePartNumber, useUpdatePartNumber, useDeletePartNumber,
} from "../hooks/useQWallSettings";
import type { PartNumber, PartNumberScanRule } from "../types";
import ScanRuleModal from "./ScanRuleModal";

type ModalMode = "create" | "edit";

interface FormState {
  ssiPN: string;
  volvoProductNumber: string;
  bu_id: number | "";
}

const EMPTY: FormState = { ssiPN: "", volvoProductNumber: "", bu_id: "" };

interface Props {
  buId?:      number;
  rulesMap:   Record<number, PartNumberScanRule>;
}

type RuleModalState =
  | { mode: "create"; partNumber: PartNumber }
  | { mode: "edit";   partNumber: PartNumber; ruleId: number };

export default function PartNumbersTab({ buId, rulesMap }: Props) {
  const { t } = useTranslation();
  const { data: items = [], isLoading, error } = usePartNumbers(buId);
  const { data: businessUnits = [] }            = useBusinessUnits();

  const create   = useCreatePartNumber();
  const update   = useUpdatePartNumber();
  const deletePn = useDeletePartNumber();

  const [search, setSearch]       = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode]           = useState<ModalMode>("create");
  const [selected, setSelected]   = useState<PartNumber | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [ruleModal, setRuleModal] = useState<RuleModalState | null>(null);

  const filtered = useMemo(() =>
    items.filter(p =>
      p.ssiPN.toLowerCase().includes(search.toLowerCase()) ||
      p.volvoProductNumber.toLowerCase().includes(search.toLowerCase()),
    ), [items, search]);

  const openCreate = () => { setSelected(null); setForm(EMPTY); setMode("create"); setModalOpen(true); setFormError(null); };
  const openEdit   = (p: PartNumber) => {
    setSelected(p);
    setForm({ ssiPN: p.ssiPN, volvoProductNumber: p.volvoProductNumber, bu_id: p.bu_id });
    setMode("edit"); setModalOpen(true); setFormError(null);
  };

  const openRuleModal = (p: PartNumber) => {
    const rule = rulesMap[p.pn_id];
    if (rule?.id) {
      setRuleModal({ mode: "edit", partNumber: p, ruleId: rule.id });
    } else {
      setRuleModal({ mode: "create", partNumber: p });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bu_id) { setFormError(t("qwallSettings.modal.buRequired")); return; }
    setSaving(true); setFormError(null);
    try {
      if (mode === "create") {
        await create.mutateAsync({ ssiPN: form.ssiPN, volvoProductNumber: form.volvoProductNumber, bu_id: Number(form.bu_id) });
      } else if (selected) {
        await update.mutateAsync({ pn_id: selected.pn_id, body: { ssiPN: form.ssiPN, volvoProductNumber: form.volvoProductNumber, bu_id: Number(form.bu_id) } });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setFormError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("qwallSettings.messages.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: PartNumber) => {
    if (!window.confirm(`¿Eliminar ${p.ssiPN}?`)) return;
    await deletePn.mutateAsync(p.pn_id);
  };

  return (
    <div style={s.tab}>
      <div style={s.toolbar}>
        <div style={s.searchWrapper}>
          <Icons.Search size={15} style={s.searchIcon} />
          <input style={s.searchInput} placeholder={t("qwallSettings.buttons.search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button style={s.newBtn} onClick={openCreate}>
          <Icons.Plus size={15} /> {t("qwallSettings.buttons.new")}
        </button>
      </div>

      {error && <p style={s.error}>{t("qwallSettings.messages.saveError")}</p>}

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t("qwallSettings.columns.partNumber")}</th>
              <th style={s.th}>{t("qwallSettings.columns.volvoPN")}</th>
              <th style={s.th}>{t("qwallSettings.columns.bu")}</th>
              <th style={s.th}>{t("qwallSettings.scanRules.configureRule")}</th>
              <th style={s.th}>{t("qwallSettings.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1,2,3].map(i => <tr key={i}><td colSpan={5} style={s.skeletonCell}><div style={s.skeleton} /></td></tr>)
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={s.empty}>{t("qwallSettings.messages.noData")}</td></tr>
            ) : filtered.map(p => {
              const rule = rulesMap[p.pn_id];
              return (
                <tr key={p.pn_id} style={s.tr}>
                  <td style={s.td}><span style={s.bold}>{p.ssiPN}</span></td>
                  <td style={s.td}><code style={s.code}>{p.volvoProductNumber}</code></td>
                  <td style={s.td}>{p.bu_name}</td>
                  <td style={s.td}>
                    <button
                      style={{ ...s.ruleBtn, ...(rule ? s.ruleBtnActive : s.ruleBtnEmpty) }}
                      onClick={() => openRuleModal(p)}
                    >
                      <Icons.ScanLine size={13} />
                      {rule
                        ? t("qwallSettings.scanRulesTab.badges.configured")
                        : t("qwallSettings.scanRulesTab.badges.notConfigured")}
                    </button>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button style={s.actionBtn} onClick={() => openEdit(p)} title={t("qwallSettings.buttons.edit")}><Icons.Pencil size={14} /></button>
                      <button style={{ ...s.actionBtn, color: "var(--color-stopped)" }} onClick={() => handleDelete(p)} title={t("qwallSettings.buttons.delete")}>
                        <Icons.Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PN create/edit modal */}
      {modalOpen && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>
                {mode === "create" ? t("qwallSettings.modal.createPN") : t("qwallSettings.modal.editPN")}
              </h3>
              <button style={s.closeBtn} onClick={() => setModalOpen(false)}><Icons.X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.partNumber")} *</label>
                <input style={s.input} value={form.ssiPN} onChange={e => setForm(f => ({ ...f, ssiPN: e.target.value }))} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.volvoPN")} *</label>
                <input style={s.input} value={form.volvoProductNumber} onChange={e => setForm(f => ({ ...f, volvoProductNumber: e.target.value }))} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.bu")} *</label>
                <select style={s.input} value={form.bu_id} onChange={e => setForm(f => ({ ...f, bu_id: Number(e.target.value) }))} required>
                  <option value="">—</option>
                  {businessUnits.map(bu => <option key={bu.bu_id} value={bu.bu_id}>{bu.bu_name}</option>)}
                </select>
              </div>
              {formError && <p style={s.formError}>{formError}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setModalOpen(false)}>{t("qwallSettings.buttons.cancel")}</button>
                <button type="submit" style={s.saveBtn} disabled={saving}>
                  {saving ? t("qwallSettings.buttons.saving") : t("qwallSettings.buttons.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan rule modal */}
      {ruleModal && (
        <ScanRuleModal
          mode={ruleModal.mode}
          partNumber={ruleModal.partNumber}
          ruleId={ruleModal.mode === "edit" ? ruleModal.ruleId : undefined}
          onClose={() => setRuleModal(null)}
          onSuccess={() => setRuleModal(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tab:          { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:      { display: "flex", gap: "0.75rem", alignItems: "center" },
  searchWrapper:{ position: "relative", flex: 1 },
  searchIcon:   { position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" },
  searchInput:  { width: "100%", padding: "0.55rem 0.75rem 0.55rem 2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", boxSizing: "border-box" },
  newBtn:       { display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", whiteSpace: "nowrap" },
  error:        { color: "var(--color-stopped)", fontSize: "0.85rem" },
  tableWrapper: { overflowX: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th:           { padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  tr:           { borderBottom: "1px solid var(--color-border)" },
  td:           { padding: "0.75rem 1rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  bold:         { fontWeight: "600" },
  code:         { fontFamily: "monospace", fontSize: "0.85rem", color: "var(--color-text-secondary)" },
  ruleBtn:      { display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer", border: "1px solid transparent", whiteSpace: "nowrap" },
  ruleBtnActive:{ backgroundColor: "rgba(22,163,74,0.1)", color: "var(--color-running)", borderColor: "rgba(22,163,74,0.3)" },
  ruleBtnEmpty: { backgroundColor: "var(--color-bg)", color: "var(--color-text-secondary)", borderColor: "var(--color-border)" },
  actions:      { display: "flex", gap: "0.375rem" },
  actionBtn:    { display: "flex", alignItems: "center", padding: "0.35rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-text-secondary)" },
  empty:        { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  skeletonCell: { padding: "0.75rem 1rem" },
  skeleton:     { height: "1rem", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-border)" },
  overlay:      { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  modal:        { backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  modalTitle:   { fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  closeBtn:     { background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex" },
  form:         { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
  field:        { display: "flex", flexDirection: "column", gap: "0.35rem" },
  label:        { fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-primary)" },
  input:        { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  formError:    { color: "var(--color-stopped)", fontSize: "0.82rem", padding: "0.4rem 0.6rem", backgroundColor: "rgba(220,38,38,0.08)", borderRadius: "var(--radius-sm)" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" },
  cancelBtn:    { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-secondary)" },
  saveBtn:      { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "none", backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
};
