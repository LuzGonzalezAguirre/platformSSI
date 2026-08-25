import { useTranslation } from "react-i18next";
import MultiSelectDropdown from "./MultiSelectDropdown";

interface Props { value: string[]; onChange: (v: string[]) => void; }

export default function ShiftSelect({ value, onChange }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const options = [
    { value: "A", label: lang === "es" ? "Turno A (6am–6pm)" : "Shift A (6am–6pm)" },
    { value: "B", label: lang === "es" ? "Turno B (6pm–6am)" : "Shift B (6pm–6am)" },
  ];

  return (
    <MultiSelectDropdown
      label={lang === "es" ? "Turno" : "Shift"}
      options={options}
      selected={value}
      onChange={onChange}
      placeholder={lang === "es" ? "Todos los turnos" : "All shifts"}
    />
  );
}