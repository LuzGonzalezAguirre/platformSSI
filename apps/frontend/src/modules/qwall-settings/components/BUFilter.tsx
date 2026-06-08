import { useTranslation } from "react-i18next";
import type { BusinessUnit } from "../types";

interface Props {
  businessUnits: BusinessUnit[];
  value: number | undefined;
  onChange: (bu_id: number | undefined) => void;
}

export default function BUFilter({ businessUnits, value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div style={s.wrapper}>
      <span style={s.label}>{t("qwallSettings.filter.label")}</span>
      <div style={s.pills}>
        <button
          style={{ ...s.pill, ...(value === undefined ? s.pillActive : {}) }}
          onClick={() => onChange(undefined)}
        >
          {t("qwallSettings.filter.allBUs")}
        </button>
        {businessUnits.map((bu) => (
          <button
            key={bu.bu_id}
            style={{ ...s.pill, ...(value === bu.bu_id ? s.pillActive : {}) }}
            onClick={() => onChange(bu.bu_id)}
          >
            {bu.bu_name}
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" },
  label:   { fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-secondary)", whiteSpace: "nowrap" },
  pills:   { display: "flex", gap: "0.375rem", flexWrap: "wrap" },
  pill: {
    padding: "0.3rem 0.85rem", borderRadius: "99px",
    border: "1px solid var(--color-border)", background: "none",
    cursor: "pointer", fontSize: "0.8rem", color: "var(--color-text-secondary)",
  },
  pillActive: {
    backgroundColor: "var(--color-primary)", borderColor: "var(--color-primary)",
    color: "#fff", fontWeight: "600",
  },
};
