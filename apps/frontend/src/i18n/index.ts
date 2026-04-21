import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/common.json";
import es from "./locales/es/common.json";

const savedLanguage = localStorage.getItem("mes_language") || "es";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: savedLanguage,
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

export default i18n;