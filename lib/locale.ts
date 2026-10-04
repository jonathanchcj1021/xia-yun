export const LOCALE_COOKIE = "xy-lang";

export type Locale = "zh-Hant" | "zh-Hans" | "en";

export const LOCALES: Locale[] = ["zh-Hant", "zh-Hans", "en"];

export function parseLocale(value: string | null | undefined): Locale {
  if (value === "zh-Hans" || value === "en" || value === "zh-Hant") return value;
  return "zh-Hant";
}

export function localeCookie(locale: Locale) {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
