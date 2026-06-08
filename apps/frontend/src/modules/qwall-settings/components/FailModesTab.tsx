import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useFailModes, useInspectionPoints,
  useCreateFailMode, useUpdateFailMode, useDeactivateFailMode, useAssignFailModePoints,
} from "../hooks/useQWallSettings";
import type { FailMode } from "../types";

type ModalMode = "create" | "edit";

interface FormState {
  fail_code: string;
  description: string;
  pointIds: number[];
}

const EMPTY: FormState = { fail_code: "", description: "", pointIds: [] };

interface Props { buId?: number; }

export default function FailModesTab({ buId }: Props) {
  const { t } = useTranslation();

  const [filterStatus, setFilterStatus] = useState<"1" | "0" | "all">("1");
  const [filterPointId, setFilterPointId] = useState<number | "">("");

  const { data: allPoints = [] } = useInspectionPoints(buId);
  const activePoints = useMemo(() => allPoints.filter(p => Boolean(p.is_active)), [allPoints]);

  const { data: items = [], isLoading, error } = useFailModes(buId, filterPointId || undefined);

  const create       = useCreateFailMode();
  const update       = useUpdateFailMode();
  const deactivate   = useDeactivateFailMode();
  const assignPoints = useAssignFailModePoints();

  const [search, setSearch]       = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode]           = useState<ModalMode>("create");
  const [selected, setSelected]   = useState<FailMode | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter(fm => {
      const active      = Boolean(fm.is_active);
      const matchSearch = fm.fail_code.toLowerCase().includes(search.toLowerCase()) ||
                          fm.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" ||
                          (filterStatus === "1" ? active : !active);
      return matchSearch && matchStatus;
    });
  }, [items, search, filterStatus]);

  const openCreate = () => {
    setSelected(null); setForm(EMPTY); setMode("create"); setModalOpen(true); setFormError(null);
  };
  const openEdit = (fm: FailMode) => {
    const currentIds = fm.assigned_points
      ? fm.assigned_points.split(", ").map(name =>
          activePoints.find(p => p.point_name === name)?.inspection_point_id
        ).filter((id): id is number => id !== undefined)
      : [];
    setSelected(fm);
    setForm({ fail_code: fm.fail_code, description: fm.description, pointIds: currentIds });
    setMode("edit"); setModalOpen(true); setFormError(null);
  };

  const togglePoint = (id: number) =>
    setForm(f => ({
      ...f,
      pointIds: f.pointIds.includes(id) ? f.pointIds.filter(x => x !== id) : [...f.pointIds, id],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      let fmId: number;
      if (mode === "create") {
        const created = await create.mutateAsync({ fail_code: form.fail_code, description: form.description });
        fmId = created.fail_mode_id;
      } else {
        if (!selected) return;
        await update.mutateAsync({ fail_mode_id: selected.fail_mode_id, body: { fail_code: form.fail_code, description: form.description } });
        fmId = selected.fail_mode_id;
      }
      await assignPoints.mutateAsync({ fail_mode_id: fmId, point_ids: form.pointIds });
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? t("qwallSettings.messages.saveError"));
    } finally { setSaving(false); }
  };

  const handleToggle = async (fm: FailMode) => {
    const active = Boolean(fm.is_active);
    if (active) {
      await deactivate.mutateAsync(fm.fail_mode_id);
    } else {
      await update.mutateAsync({ fail_mode_id: fm.fail_mode_id, body: { is_active: 1 } });
    }
  };

  return (
    <div style={s.tab}>
      <div style={s.toolbar}>
        <div style={s.searchWrapper}>
          <Icons.Search size={15} style={s.searchIcon} />
          <input style={s.searchInput} placeholder={t("qwallSettings.buttons.search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Filtro por punto de inspección */}
        <select
          style={s.filterSelect}
          value={filterPointId}
          onChange={e => setFilterPointId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">{t("qwallSettings.filter.allPoints")}</option>
          {allPoints.map(p => (
            <option key={p.inspection_point_id} value={p.inspection_point_id}>{p.point_name}</option>
          ))}
        </select>

        {/* Filtro por estado */}
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
              <th style={s.th}>{t("qwallSettings.columns.failCode")}</th>
              <th style={s.th}>{t("qwallSettings.columns.description")}</th>
              <th style={s.th}>{t("qwallSettings.columns.assignedPoints")}</th>
              <th style={s.th}>{t("qwallSettings.columns.active")}</th>
              <th style={s.th}>{t("qwallSettings.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1,2,3].map(i => <tr key={i}><td colSpan={5} style={s.skeletonCell}><div style={s.skeleton} /></td></tr>)
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={s.empty}>{t("qwallSettings.messages.noData")}</td></tr>
            ) : filtered.map(fm => {
              const active = Boolean(fm.is_active);
              return (
                <tr key={fm.fail_mode_id} style={s.tr}>
                  <td style={s.td}><code style={s.code}>{fm.fail_code}</code></td>
                  <td style={s.td}><span style={s.bold}>{fm.description}</span></td>
                  <td style={s.td}>
                    <div style={s.chips}>
                      {fm.assigned_points ? fm.assigned_points.split(", ").map(pt => (
                        <span key={pt} style={s.chip}>{pt}</span>
                      )) : <span style={s.none}>—</span>}
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(active ? s.badgeActive : s.badgeInactive) }}>
                      {active ? t("qwallSettings.status.active") : t("qwallSettings.status.inactive")}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button style={s.actionBtn} onClick={() => openEdit(fm)} title={t("qwallSettings.buttons.edit")}><Icons.Pencil size={14} /></button>
                      <button style={{ ...s.actionBtn, color: active ? "var(--color-stopped)" : "var(--color-running)" }} onClick={() => handleToggle(fm)}>
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
                {mode === "create" ? t("qwallSettings.modal.createFailMode") : t("qwallSettings.modal.editFailMode")}
              </h3>
              <button style={s.closeBtn} onClick={() => setModalOpen(false)}><Icons.X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.failCode")} *</label>
                <input style={s.input} value={form.fail_code} onChange={e => setForm(f => ({ ...f, fail_code: e.target.value }))} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.columns.description")} *</label>
                <input style={s.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t("qwallSettings.modal.assignPoints")}</label>
                <div style={s.checkboxList}>
                  {activePoints.length === 0 ? (
                    <p style={s.noPointsMsg}>{t("qwallSettings.messages.noPointsInBU")}</p>
                  ) : activePoints.map(p => (
                    <label key={p.inspection_point_id} style={s.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={form.pointIds.includes(p.inspection_point_id)}
                        onChange={() => togglePoint(p.inspection_point_id)}
                      />
                      <span>{p.point_name}</span>
                      <span style={s.buHint}>{p.bu_name}</span>
                    </label>
                  ))}
                </div>
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
  tab:          { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:      { display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" },
  searchWrapper:{ position: "relative", flex: 1, minWidth: "160px" },
  searchIcon:   { position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" },
  searchInput:  { width: "100%", padding: "0.55rem 0.75rem 0.55rem 2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", boxSizing: "border-box" },
  filterSelect: { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", minWidth: "140px" },
  newBtn:       { display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", backgroundColor: "var(--color-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", whiteSpace: "nowrap" },
  error:        { color: "var(--color-stopped)", fontSize: "0.85rem" },
  tableWrapper: { overflowX: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th:           { padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  tr:           { borderBottom: "1px solid var(--color-border)" },
  td:           { padding: "0.75rem 1rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  bold:         { fontWeight: "600" },
  code:         { fontFamily: "monospace", fontSize: "0.85rem", color: "var(--color-text-secondary)" },
  chips:        { display: "flex", flexWrap: "wrap", gap: "0.25rem" },
  chip:         { padding: "0.15rem 0.5rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "600", backgroundColor: "rgba(10,110,189,0.1)", color: "var(--color-primary)", whiteSpace: "nowrap" },
  none:         { color: "var(--color-text-secondary)", fontSize: "0.8rem" },
  badge:        { padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "600" },
  badgeActive:  { backgroundColor: "rgba(22,163,74,0.1)", color: "var(--color-running)" },
  badgeInactive:{ backgroundColor: "rgba(220,38,38,0.1)", color: "var(--color-stopped)" },
  actions:      { display: "flex", gap: "0.375rem" },
  actionBtn:    { display: "flex", alignItems: "center", padding: "0.35rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-text-secondary)" },
  empty:        { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  skeletonCell: { padding: "0.75rem 1rem" },
  skeleton:     { height: "1rem", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-border)" },
  overlay:      { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  modal:        { backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" },
  modalTitle:   { fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  closeBtn:     { background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex" },
  form:         { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
  field:        { display: "flex", flexDirection: "column", gap: "0.35rem" },
  label:        { fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-primary)" },
  input:        { padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)" },
  checkboxList: { border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-bg)", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "220px", overflowY: "auto" },
  checkboxRow:  { display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--color-text-primary)" },
  buHint:       { marginLeft: "auto", fontSize: "0.75rem", color: "var(--color-text-secondary)" },
  noPointsMsg:  { fontSize: "0.82rem", color: "var(--color-text-secondary)", padding: "0.25rem 0" },
  formError:    { color: "var(--color-stopped)", fontSize: "0.82rem", padding: "0.4rem 0.6rem", backgroundColor: "rgba(220,38,38,0.08)", borderRadius: "var(--radius-sm)" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" },
  cancelBtn:    { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-secondary)" },
  saveBtn:      { padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)", border: "none", backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
};
