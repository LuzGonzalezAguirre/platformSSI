import { useState } from "react";
import type { ChairFilters } from "../api/chairApi";

interface Props {
  filters: ChairFilters;
  onChange: (f: ChairFilters) => void;
}

const DEPARTMENTS = ["Assembly", "Welding", "Paint", "Quality", "Maintenance", "Warehouse"];

export function FiltersBar({ filters, onChange }: Props) {
  const [local, setLocal] = useState<ChairFilters>(filters);

  const apply = () => onChange(local);
  const clear = () => {
    const defaults: ChairFilters = {
      start_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
    };
    setLocal(defaults);
    onChange(defaults);
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "14px 20px",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "flex-end",
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
      }}
    >
      <Field label="Fecha inicio">
        <input
          type="date"
          value={local.start_date}
          onChange={(e) => setLocal({ ...local, start_date: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <Field label="Fecha fin">
        <input
          type="date"
          value={local.end_date}
          onChange={(e) => setLocal({ ...local, end_date: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <Field label="Turno">
        <select
          value={local.turno || ""}
          onChange={(e) => setLocal({ ...local, turno: e.target.value || undefined })}
          style={inputStyle}
        >
          <option value="">Todos</option>
          <option value="A">Turno A</option>
          <option value="B">Turno B</option>
        </select>
      </Field>

      <Field label="Departamento">
        <select
          value={local.department || ""}
          onChange={(e) => setLocal({ ...local, department: e.target.value || undefined })}
          style={inputStyle}
        >
          <option value="">Todos</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={apply} style={btnPrimary}>
          Aplicar filtros
        </button>
        <button onClick={clear} style={btnSecondary}>
          Limpiar
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 13,
  outline: "none",
  minWidth: 140,
};

const btnPrimary: React.CSSProperties = {
  background: "#0070C0",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 18px",
  fontSize: 13,
  cursor: "pointer",
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  background: "#f0f0f0",
  color: "#333",
  border: "1px solid #d0d5dd",
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
};
