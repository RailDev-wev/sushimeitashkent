export const locales = ["ru", "uz", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";
export const localeCookie = "locale";

export const localeLabels: Record<Locale, string> = {
  ru: "Рус",
  uz: "O‘zb",
  en: "Eng",
};

export function hasLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Maps a Telegram/browser language code ("uz", "ru-RU", "en-US") to a supported locale. */
export function matchLocale(code: string | undefined | null): Locale | null {
  const base = code?.toLowerCase().split(/[-_]/)[0];
  return hasLocale(base) ? base : null;
}
