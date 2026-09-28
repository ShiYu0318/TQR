// UI language. Strings are keyed by their Traditional Chinese original (as in the reference app), so Chinese needs no
// table and a missing English entry falls back to Chinese. en.json began as the reference app's EN table.
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./en.json";

export type Lang = "zh" | "en";

void i18next.use(initReactI18next).init({
  lng: "zh",
  resources: { en: { translation: en }, zh: { translation: {} } },
  fallbackLng: false,
  keySeparator: false,
  nsSeparator: false,
  // {name}, as the reference app writes placeholders
  interpolation: { prefix: "{", suffix: "}", escapeValue: false },
  returnEmptyString: false,
  initAsync: false,
});

/** translate a Chinese UI string; {name} placeholders are filled from vars */
export function t(zh: string, vars?: Record<string, string | number>): string {
  return i18next.t(zh, vars ?? {}) as string;
}

/** t for components: re-renders the component when the language changes */
export function useT() {
  useTranslation();
  return t;
}

export function setLanguage(lang: Lang) {
  if (i18next.language !== lang) void i18next.changeLanguage(lang);
  if (typeof document !== "undefined") document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
}

/** the viewer's language when nothing is saved yet */
export function defaultLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language : "zh";
  return /^zh/i.test(nav || "") ? "zh" : "en";
}

export { i18next };
