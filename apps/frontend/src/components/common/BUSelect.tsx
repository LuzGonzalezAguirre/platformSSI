import MultiSelectDropdown from "./MultiSelectDropdown";
import { useTranslation } from "react-i18next";

interface Choice { value: string; label: string; }
interface Props { value: string[]; onChange: (v: string[]) => void; options: Choice[]; }

export default function BUSelect({ value, onChange, options }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  return (
    <MultiSelectDropdown
      label="BU"
      options={options}
      selected={value}
      onChange={onChange}
      placeholder={lang === "es" ? "Todas las BUs" : "All BUs"}
    />
  );
}