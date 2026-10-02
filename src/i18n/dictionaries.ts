import ru from "./dictionaries/ru.json";
import uz from "./dictionaries/uz.json";
import en from "./dictionaries/en.json";
import type { Locale } from "./config";

export type Dictionary = typeof ru;

// Small enough to bundle all three; the server picks one and passes it to the client.
const dictionaries: Record<Locale, Dictionary> = { ru, uz, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replaces {name} placeholders. */
export function format(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export function formatPrice(amount: number, dict: Dictionary) {
  // Spaces as thousand separators read naturally in all three languages here.
  const n = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n} ${dict.currency}`;
}
