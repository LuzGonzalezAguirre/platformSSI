import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useInspectionPoints, useBusinessUnits,
  useCreateInspectionPoint, useUpdateInspectionPoint, useDeactivateInspectionPoint,
} from "../hooks/useQWallSettings";
import type { InspectionPoint } from "../types";

type ModalMode = "create" | "edit";

interface FormState {
  point_name: string;
  bu_id: number | "";
  sequence_order: number | "";
}

const EMPTY: FormState = { point_name: "", bu_id: "", sequence_order: "" };

function isDuplicateError(err: any): boolean {
  const msg: string = err?.response?.data?.error ?? err?.message ?? "";
  return msg.includes("UNIQUE") || msg.includes("duplicate key") || msg.includes("2627") || msg.includes("UQ__");
}

interface Props { buId?: number; }

export default function InspectionPointsTab({ buId }: Props) {
  const { t } = useTranslation();
  const { data: items = [], isLoading, error } = useInspectionPoints(buId);
  const { data: businessUnits = [] } = useBusinessUnits();
  const create     = useCreateInspectionPoint();
  const update     = useUpdateInspectionPoint();
  const deactivate = useDeactivateInspectionPoint();

  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState<"1" | "0" | "all">("1");
  const [modalOpen, setModalOpen]       = useState(false);
  const [mode, setMode]                 = useState<ModalMode>("create");
  const [selected, setSelected]         = useState<InspectionPoint | null>(null);
  const [form, setForm]                 = useState<FormState>(EMPTY);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);
  const [hoverPointId, setHoverPointId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return items.filter(p => {
      const active      = Boolean(p.is_active);
      const matchSearch = p.point_name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || (filterStatus === "1" ? active : !active);
      return matchSearch && matchStatus;
    });
  }, [items, search, filterStatus]);

  const openCreate = () => {
    setSelected(null); setForm(EMPTY); setMode("create"); setModalOpen(true); setFormError(null);
  };
  const openEdit = (p: InspectionPoint) => {
    setSelected(p);
    setForm({ point_name: p.point_name, bu_id: p.bu_id, sequence_order: p.sequence_order });
    setMode("edit"); setModalOpen(true); setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bu_id) { setFormError(t("qwallSettings.modal.buRequired")); return; }
    setSaving(true); setFormError(null);
    try {
      if (mode === "create") {
        await create.mutateAsync({
          point_name: form.point_name,
          bu_id: Number(form.bu_id),
          sequence_order: Number(form.sequence_order) || 0,
        });
      } else if (selected) {
        await update.mutateAsync({
          point_id: selected.inspection_point_id,
          body: { point_name: form.point_name, bu_id: Number(form.bu_id), sequence_order: Number(form.sequence_order) || 0 },
        });
      }
      setModalOpen(false);
    } catch (err: any) {
      if (isDuplicateError(err)) {
        setFormError(t("qwallSettings.messages.duplicateName"));
      } else {
        setFormError(t("qwallSettings.messages.saveError"));
      }
    } finally { setSaving(false); }
  };

  const handleToggle = async (p: InspectionPoint) => {
    const active = Boolean(p.is_active);
    if (active) await deactivate.mutateAsync(p.inspection_point_id);
    else await update.mutateAsync({ point_id: p.inspection_point_id, body: { is_active: 1 } });
  };

  const handleReorder = async (p: InspectionPoint, dir: "up" | "down") => {
    await update.mutateAsync({
      point_id: p.inspection_point_id,
      body: { sequence_order: dir === "up" ? p.sequence_order - 1 : p.sequence_order + 1 },
    });
  };

  return (
    <div style={s.tab}>
      <div style={s.toolbar}>
        <div style={s.searchWrapper}>
          <Icons.Search size={15} style={s.searchIcon} />
          <input style={s.searchInput} placeholder={t("qwallSettings.buttons.search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={s.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value as "1"|"0"|"all")}>
          <option value="1">{t("qwallSettings.status.active")}</option>
          <option value="0">{t("qwallSettings.status.inactive")}</option>
          <option value="all">{t("qwallSettings.filter.allStatuses")}</option>
        </select>
        <button style={s.newBtn} onClick={openCreate}>
          <Icons.Plus size={15} /> {t("qwallSettings.buttons.new")}
        </button>
      </div>

      {error && <p style={s.error}>{t("qwallSettings.messages.saveError")}</p>}

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t("qwallSettings.columns.order")}</th>
              <th style={s.th}>{t("qwallSettings.columns.pointName")}</th>
              <th style={s.th}>{t("qwallSettings.columns.bu")}</th>
              <th style={s.th}>{t("qwallSettings.columns.failModes")}</th>
              <th style={s.th}>{t("qwallSettings.columns.active")}</th>
              <th style={s.th}>{t("qwallSettings.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1,2,3].map(i => <tr key={i}><td colSpan={6} style={s.skeletonCell}><div style={s.skeleton} /></td></tr>)
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={s.empty}>{t("qwallSettings.messages.noData")}</td></tr>
            ) : filtered.map((p, idx) => {
              const active   = Boolean(p.is_active);
              const codes    = p.fail_modes_list ? p.fail_modes_list.split(", ") : [];
              const count    = codes.length;
              const isHover  = hoverPointId === p.inspection_point_id;

              return (
                <tr key={p.inspection_point_id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.orderCell}>
                      <span style={s.orderBadge}>{p.sequence_order}</span>
                      <div style={s.reorderBtns}>
                        <button style={s.reorderBtn} onClick={() => handleReorder(p, "up")} disabled={idx === 0}><Icons.ChevronUp size={12} /></button>
                        <button style={s.reorderBtn} onClick={() => handleReorder(p, "down")} disabled={idx === filtered.length - 1}><Icons.ChevronDown size={12} /></button>
                      </div>
                    </div>
                  </td>
                  <td style={s.td}><span style={s.bold}>{p.point_name}</span></td>
                  <td style={s.td}>{p.bu_name}</td>

                  {/* Fail modes: número + tooltip al hover */}
                  <td style={s.td}>
                    <div
                      style={s.tooltipWrapper}
                      onMouseEnter={() => setHoverPointId(p.inspection_point_id)}
                      onMouseLeave={() => setHoverPointId(null)}
                    >
                      <span style={{ ...s.countBadge, ...(count === 0 ? s.countBadgeEmpty : {}) }}>
                        {count}
                      </span>
                      {isHover && count > 0 && (
                        <div style={s.tooltip}>
                          {codes.map(code => (
                            <div key={code} style={s.tooltipItem}>{code}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(active ? s.badgeActive : s.badgeInactive) }}>
                      {active ? t("qwallSettings.status.active") : t("qwallSettings.status.inactive")}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button style={s.actionBtn} onClick={() => openEdit(p)} title={t("qwallSettings.buttons.edit")}><Icons.Pencil size={14} /></button>
                      <button style={{ ...s.actionBtn, color: active ? "var(--color-stopped)" : "var(--color-running)" }} onClick={() => handleToggle(p)}>
                        {active ? <Icons.ToggleLeft size={14} /> : <Icons.ToggleRight size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>
                {mode === "create" ? t("qwallSettings.modal.createPoint") : t("qwallSettings.modal.editPoint")}
              </h3>
              <button style={s.closeBtn} onClick={() => setModalOpen(false)}><Icons.X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.pointName")} *</label>
                <input style={s.input} value={form.point_name} onChange={e => setForm(f => ({ ...f, point_name: e.target.value }))} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.bu")} *</label>
                <select style={s.input} value={form.bu_id} onChange={e => setForm(f => ({ ...f, bu_id: Number(e.target.value) }))} required>
                  <option value="">—</option>
                  {businessUnits.map(bu => <option key={bu.bu_id} value={bu.bu_id}>{bu.bu_name}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.order")}</label>
                <input style={s.input} type="number" min={0} value={form.sequence_order} onChange={e => setForm(f => ({ ...f, sequence_order: Number(e.target.value) }))} />
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
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tab:            { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:        { display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" },
  searchWrapper:  { position: "relative", flex: 1, minWidth: "160px" },
  searchIcon:     { position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" },
  searchInput:    { width: "100%", padding: "0.55rem 0.75rem 0.55rem 2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", boxSizing: "border-box" },
  filterSelect:   { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "130px" },
  newBtn:         { display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", whiteSpace: "nowrap" },
  error:          { color: "var(--color-stopped)", fontSize: "0.85rem" },
  tableWrapper:   { overflowX: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:          { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th:             { padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  tr:             { borderBottom: "1px solid var(--color-border)" },
  td:             { padding: "0.75rem 1rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  bold:           { fontWeight: "600" },
  orderCell:      { display: "flex", alignItems: "center", gap: "0.5rem" },
  orderBadge:     { width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary)" },
  reorderBtns:    { display: "flex", flexDirection: "column", gap: "1px" },
  reorderBtn:     { display: "flex", padding: "1px 3px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", lineHeight: 1 },
  tooltipWrapper: { position: "relative", display: "inline-block" },
  countBadge:     { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "24px", padding: "0.15rem 0.5rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "700", backgroundColor: "rgba(10,110,189,0.1)", color: "var(--color-primary)", cursor: "default" },
  countBadgeEmpty:{ backgroundColor: "var(--color-bg)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" },
  tooltip:        { position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", zIndex: 100, minWidth: "120px", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", pointerEvents: "none" },
  tooltipItem:    { fontSize: "0.78rem", color: "var(--color-text-primary)", fontFamily: "monospace", padding: "0.1rem 0", whiteSpace: "nowrap" },
  badge:          { padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "600" },
  badgeActive:    { backgroundColor: "rgba(22,163,74,0.1)", color: "var(--color-running)" },
  badgeInactive:  { backgroundColor: "rgba(220,38,38,0.1)", color: "var(--color-stopped)" },
  actions:        { display: "flex", gap: "0.375rem" },
  actionBtn:      { display: "flex", alignItems: "center", padding: "0.35rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-text-secondary)" },
  empty:          { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  skeletonCell:   { padding: "0.75rem 1rem" },
  skeleton:       { height: "1rem", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-border)" },
  overlay:        { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  modal:          { backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHeader:    { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  modalTitle:     { fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  closeBtn:       { background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex" },
  form:           { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
  field:          { display: "flex", flexDirection: "column", gap: "0.35rem" },
  label:          { fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-primary)" },
  input:          { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  formError:      { color: "var(--color-stopped)", fontSize: "0.82rem", padding: "0.4rem 0.6rem", backgroundColor: "rgba(220,38,38,0.08)", borderRadius: "var(--radius-sm)" },
  modalActions:   { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" },
  cancelBtn:      { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-secondary)" },
  saveBtn:        { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "none", backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
};
