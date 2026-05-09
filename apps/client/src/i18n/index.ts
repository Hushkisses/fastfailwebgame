import ko from "./locales/ko.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";

export type Locale = "ko" | "en" | "ja" | "zh";

type Dictionary = Record<string, string>;

const STORAGE_KEY = "failure-growth-locale";

export const locales: Locale[] = ["ko", "en", "ja", "zh"];

const dictionaries: Record<Locale, Dictionary> = {
  ko,
  en,
  ja,
  zh
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

export function htmlLang(locale: Locale): string {
  if (locale === "ja") return "ja";
  if (locale === "zh") return "zh-CN";
  if (locale === "en") return "en";
  return "ko";
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "ko";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;

  const browserLocale = window.navigator.language.toLowerCase();
  if (browserLocale.startsWith("ja")) return "ja";
  if (browserLocale.startsWith("zh")) return "zh";
  if (browserLocale.startsWith("en")) return "en";
  return "ko";
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = htmlLang(locale);
}

export function t(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const template = dictionaries[locale][key] ?? dictionaries.ko[key] ?? key;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}
