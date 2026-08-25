import { useState, useRef, useEffect } from "react";

interface Option { value: string; label: string; }

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}

export default function MultiSelectDropdown({ label, options, selected, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const triggerLabel = selected.length === 0 ? placeholder : `${label} (${selected.length})`;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={s.trigger}>
        <span>{triggerLabel}</span>
        <span style={{ fontSize: "0.65rem", opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={s.dropdown}>
          {options.map((o) => (
            <label key={o.value} style={s.option}>
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-surface)",
    color: "var(--color-text-primary)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  },
  dropdown: {
    position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
    minWidth: 180, maxHeight: 280, overflowY: "auto",
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: "0.375rem 0",
  },
  option: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "0.375rem 0.75rem", fontSize: "0.8125rem", color: "var(--color-text-primary)", cursor: "pointer",
  },
};