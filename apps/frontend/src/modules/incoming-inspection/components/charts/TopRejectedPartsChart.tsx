import React from "react";
import { useTranslation } from "react-i18next";
import type { TopRejectedPart } from "../../types";
import { COLORS, LABEL } from "../ui";

interface Props { data: TopRejectedPart[]; }

const TopRejectedPartsChart: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();

  if (!data.length) {
    return <div style={{ fontSize: "0.8rem", color: LABEL }}>{t("incomingInspection.dashboard.noData")}</div>;
  }

  const max = Math.max(...data.map(row => row.rejected), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {data.map(row => (
        <div key={row.part_no} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 130px) 1fr auto", alignItems: "center", gap: "0.6rem" }}>
          <span
            title={row.part_no}
            style={{ fontSize: "0.72rem", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {row.part_no}
          </span>
          <div style={{ background: "var(--color-border)", borderRadius: "4px", height: "14px", overflow: "hidden" }}>
            <div
              style={{
                width: `${(row.rejected / max) * 100}%`,
                height: "100%",
                background: COLORS.bad,
                borderRadius: "4px",
              }}
              title={`${row.rejected}/${row.total} (${row.rejection_rate}%)`}
            />
          </div>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-primary)", minWidth: "70px", textAlign: "right" }}>
            {row.rejected} <span style={{ fontWeight: 400, color: LABEL }}>/ {row.total} · {row.rejection_rate}%</span>
          </span>
        </div>
      ))}
    </div>
  );
};

export default TopRejectedPartsChart;