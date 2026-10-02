import type { Locale } from "@/i18n/config";

// Restaurant details shown on the site (taken from sushimei.clopos.menu). Fields set to null are hidden.
export const site = {
  name: "SUSHIMEI",
  phone: "+998 99 949 51 15" as string | null,
  hours: "8:00–23:00" as string | null, // every day
  instagram: { handle: "sushimei.uz", url: "https://www.instagram.com/sushimei.uz/" } as { handle: string; url: string } | null,
  // Pickup address, also shown in the footer
  address: {
    ru: "Ташкент, Яшнабадский район, ул. Иззат, 89",
    uz: "Toshkent sh., Yashnobod tumani, Izzat ko‘chasi, 89-uy",
    en: "89 Izzat St, Yashnobod District, Tashkent",
  } as Record<Locale, string> | null,
  mapUrl: "https://www.google.com/maps/search/?api=1&query=41.2697979,69.3433849" as string | null,
};

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
