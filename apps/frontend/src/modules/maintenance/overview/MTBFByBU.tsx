import { MaintenanceBU_MTBF } from "./types";

interface Props {
  data: MaintenanceBU_MTBF[];
  lang: string;
}

export default function MTBFByBU({ data, lang }: Props) {
  return (
    <section style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" }}>
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
        {lang === "es" ? "MTBF por Business Unit" : "MTBF by Business Unit"}
      </h2>
      <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
        {lang === "es"
          ? "Horas Running / Work Requests Unplanned Maintenance. Solo BUs permitidas; solicitudes sin BU identificable permanecen en el total global."
          : "Running hours / Unplanned Maintenance Work Requests. Authorized BUs only; unassigned requests remain in the plant-wide total."}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", color: "var(--color-text-primary)" }}>
          <thead>
            <tr>
              {(lang === "es" ? ["Business Unit", "Horas Running", "WR Unplanned", "MTBF (h)"] : ["Business Unit", "Running Hours", "Unplanned WRs", "MTBF (h)"]).map((label) => (
                <th key={label} scope="col" style={{ textAlign: label === "Business Unit" ? "left" : "right", padding: "0.75rem", borderBottom: "1px solid var(--color-border)" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "0.75rem", color: "var(--color-text-secondary)" }}>{lang === "es" ? "Sin datos para las BU seleccionadas" : "No data for the selected BUs"}</td></tr>
            ) : data.map((row) => (
              <tr key={row.bu}>
                <th scope="row" style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--color-border)" }}>{row.bu}</th>
                <td style={{ textAlign: "right", padding: "0.75rem", borderBottom: "1px solid var(--color-border)" }}>{row.operating_hours.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "0.75rem", borderBottom: "1px solid var(--color-border)" }}>{row.total_failures}</td>
                <td style={{ textAlign: "right", padding: "0.75rem", borderBottom: "1px solid var(--color-border)", fontWeight: 700 }}>{row.mtbf_hours == null ? "—" : row.mtbf_hours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
