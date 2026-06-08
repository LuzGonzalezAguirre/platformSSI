import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { useTranslation } from "react-i18next";
import { useScanRules, useToggleScanRule, useDeleteScanRule } from "../hooks/useQWallSettings";
import type { PartNumber, PartNumberScanRule } from "../types";
import ScanRuleModal from "./ScanRuleModal";

interface Props { buId?: number; }

function ruleToPartNumber(r: PartNumberScanRule): PartNumber {
  return { pn_id: r.pn_id, ssiPN: r.ssi_pn, volvoProductNumber: "", bu_id: r.bu_id, bu_name: r.bu_name };
}

export default function PartNumberRulesTab({ buId }: Props) {
  const { t } = useTranslation();
  const { data: rules = [], isLoading } = useScanRules(buId);
  const toggle     = useToggleScanRule();
  const deleteRule = useDeleteScanRule();

  const [search,   setSearch]   = useState("");
  const [editRule, setEditRule] = useState<PartNumberScanRule | null>(null);

  const filtered = useMemo(() =>
    rules.filter(r => r.ssi_pn.toLowerCase().includes(search.toLowerCase())),
    [rules, search],
  );

  const handleToggle = async (r: PartNumberScanRule) => {
    await toggle.mutateAsync(r.id!);
  };

  const handleDelete = async (r: PartNumberScanRule) => {
    if (!window.confirm(`¿Eliminar regla de ${r.ssi_pn}?`)) return;
    await deleteRule.mutateAsync(r.id!);
  };

  return (
    <div style={s.tab}>
      <div style={s.toolbar}>
        <div style={s.searchWrapper}>
          <Icons.Search size={15} style={s.searchIcon} />
          <input
            style={s.searchInput}
            placeholder={t("qwallSettings.buttons.search")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>PN SSI</th>
              <th style={s.th}>{t("qwallSettings.columns.bu")}</th>
              <th style={s.th}>{t("qwallSettings.scanRules.scanCount")}</th>
              <th style={s.th}>{t("qwallSettings.scanRulesTab.columns.fieldCount")}</th>
              <th style={s.th}>{t("qwallSettings.scanRules.requiresMatch")}</th>
              <th style={s.th}>{t("qwallSettings.scanRulesTab.columns.lastEdited")}</th>
              <th style={s.th}>{t("qwallSettings.columns.active")}</th>
              <th style={s.th}>{t("qwallSettings.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1,2,3].map(i => (
                <tr key={i}><td colSpan={8} style={s.skeletonCell}><div style={s.skeleton} /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={s.empty}>{t("qwallSettings.messages.noData")}</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} style={s.tr}>
                <td style={s.td}><span style={s.bold}>{r.ssi_pn}</span></td>
                <td style={s.td}>{r.bu_name}</td>
                <td style={s.td}>{r.scan_count}</td>
                <td style={s.td}>{r.field_count ?? 0}</td>
                <td style={s.td}>{r.requires_match ? "✓" : "—"}</td>
                <td style={s.td}>
                  {r.updated_at
                    ? new Date(r.updated_at).toLocaleDateString()
                    : "—"}
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, ...(r.is_active ? s.badgeActive : s.badgeInactive) }}>
                    {r.is_active
                      ? t("qwallSettings.status.active")
                      : t("qwallSettings.status.inactive")}
                  </span>
                </td>
                <td style={s.td}>
                  <div style={s.actions}>
                    <button
                      style={s.actionBtn}
                      onClick={() => setEditRule(r)}
                      title={t("qwallSettings.buttons.edit")}
                    >
                      <Icons.Pencil size={14} />
                    </button>
                    <button
                      style={s.actionBtn}
                      onClick={() => handleToggle(r)}
                      title={r.is_active
                        ? t("qwallSettings.buttons.deactivate")
                        : t("qwallSettings.buttons.activate")}
                    >
                      {r.is_active
                        ? <Icons.ToggleRight size={14} />
                        : <Icons.ToggleLeft  size={14} />}
                    </button>
                    <button
                      style={{ ...s.actionBtn, color: "var(--color-stopped)" }}
                      onClick={() => handleDelete(r)}
                      title={t("qwallSettings.buttons.delete")}
                    >
                      <Icons.Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editRule && (
        <ScanRuleModal
          mode="edit"
          partNumber={ruleToPartNumber(editRule)}
          ruleId={editRule.id}
          onClose={() => setEditRule(null)}
          onSuccess={() => setEditRule(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tab:          { display: "flex", flexDirection: "column", gap: "1rem" },
  toolbar:      { display: "flex", gap: "0.75rem", alignItems: "center" },
  searchWrapper:{ position: "relative", flex: 1, maxWidth: "320px" },
  searchIcon:   { position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" },
  searchInput:  { width: "100%", padding: "0.55rem 0.75rem 0.55rem 2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg)", boxSizing: "border-box" },
  tableWrapper: { overflowX: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" },
  th:           { padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" },
  tr:           { borderBottom: "1px solid var(--color-border)" },
  td:           { padding: "0.75rem 1rem", color: "var(--color-text-primary)", verticalAlign: "middle" },
  bold:         { fontWeight: "600" },
  badge:        { padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "600" },
  badgeActive:  { backgroundColor: "rgba(22,163,74,0.1)", color: "var(--color-running)" },
  badgeInactive:{ backgroundColor: "rgba(220,38,38,0.1)", color: "var(--color-stopped)" },
  actions:      { display: "flex", gap: "0.375rem" },
  actionBtn:    { display: "flex", alignItems: "center", padding: "0.35rem", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--color-text-secondary)" },
  empty:        { padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" },
  skeletonCell: { padding: "0.75rem 1rem" },
  skeleton:     { height: "1rem", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-border)" },
};
