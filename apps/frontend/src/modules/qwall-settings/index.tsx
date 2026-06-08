import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useBusinessUnits, useScanRules } from "./hooks/useQWallSettings";
import type { PartNumberScanRule } from "./types";
import BUFilter from "./components/BUFilter";
import UsersTab from "./components/UsersTab";
import PartNumbersTab from "./components/PartNumbersTab";
import InspectionPointsTab from "./components/InspectionPointsTab";
import FailModesTab from "./components/FailModesTab";
import GeneralSettingsTab from "./components/GeneralSettingsTab";
import PartNumberRulesTab from "./components/PartNumberRulesTab";

type TabId = "users" | "partNumbers" | "inspectionPoints" | "failModes" | "scanRules" | "general";

const TABS: TabId[] = ["users", "partNumbers", "inspectionPoints", "failModes", "scanRules", "general"];
const NO_BU_TABS: TabId[] = ["users", "general"];

export default function QWallSettingsPage() {
  const { t } = useTranslation();
  const { data: businessUnits = [] } = useBusinessUnits();

  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [buId, setBuId]           = useState<number | undefined>(undefined);

  const showBUFilter = !NO_BU_TABS.includes(activeTab);

  // Load scan rules in parallel with part numbers so PartNumbersTab badge data
  // is ready without a waterfall when the user switches to that tab.
  const { data: scanRules = [] } = useScanRules(buId);

  const rulesMap = useMemo<Record<number, PartNumberScanRule>>(() => {
    const map: Record<number, PartNumberScanRule> = {};
    scanRules.forEach(r => { map[r.pn_id] = r; });
    return map;
  }, [scanRules]);

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t("qwallSettings.title")}</h1>
          <p style={s.pageSubtitle}>{t("qwallSettings.subtitle")}</p>
        </div>
      </div>

      <div style={s.topBar}>
        <nav style={s.tabs}>
          {TABS.map(tab => (
            <button
              key={tab}
              style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {t(`qwallSettings.tabs.${tab}`)}
            </button>
          ))}
        </nav>

        {showBUFilter && (
          <BUFilter businessUnits={businessUnits} value={buId} onChange={setBuId} />
        )}
      </div>

      <div style={s.content}>
        {activeTab === "users"            && <UsersTab />}
        {activeTab === "partNumbers"      && <PartNumbersTab buId={buId} rulesMap={rulesMap} />}
        {activeTab === "inspectionPoints" && <InspectionPointsTab buId={buId} />}
        {activeTab === "failModes"        && <FailModesTab buId={buId} />}
        {activeTab === "scanRules"        && <PartNumberRulesTab buId={buId} />}
        {activeTab === "general"          && <GeneralSettingsTab />}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:        { display: "flex", flexDirection: "column", gap: "1.25rem" },
  pageHeader:  { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  pageTitle:   { fontSize: "1.4rem", fontWeight: "700", color: "var(--color-text-primary)", margin: 0 },
  pageSubtitle:{ fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: "0.25rem 0 0" },
  topBar:      { display: "flex", flexDirection: "column", gap: "0.75rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.75rem" },
  tabs:        { display: "flex", gap: "0.25rem", flexWrap: "wrap" },
  tab: {
    padding: "0.5rem 1rem", borderRadius: "var(--radius-md)",
    border: "none", background: "none", cursor: "pointer",
    fontSize: "0.875rem", fontWeight: "500", color: "var(--color-text-secondary)",
    whiteSpace: "nowrap",
  },
  tabActive: {
    backgroundColor: "var(--color-surface-raised)",
    color: "var(--color-text-primary)", fontWeight: "600",
  },
  content: { flex: 1 },
};
