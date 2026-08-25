import MultiSelectDropdown from "./MultiSelectDropdown";
import { useTranslation } from "react-i18next";

interface Choice { value: string; label: string; }
interface Props { value: string[]; onChange: (v: string[]) => void; options: Choice[]; }

export default function WorkcenterSelect({ value, onChange, options }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  return (
    <MultiSelectDropdown
      label="Workcenter"
      options={options}
      selected={value}
      onChange={onChange}
      placeholder={lang === "es" ? "Todos los workcenters" : "All workcenters"}
    />
  );
}