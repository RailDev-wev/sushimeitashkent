import type { Locale } from "@/i18n/config";

export type Branch = {
  /** Stable id: stored in the stop-list and in customers' saved choice. Don't rename. */
  id: string;
  name: Record<Locale, string>;
  address: Record<Locale, string>;
  lat: number;
  lng: number;
};

// Add new branches here. With a single branch the picker is hidden.
export const branches: Branch[] = [
  {
    id: "izzat",
    name: { ru: "Иззат", uz: "Izzat", en: "Izzat" },
    address: {
      ru: "Ташкент, Яшнабадский район, ул. Иззат, 89",
      uz: "Toshkent sh., Yashnobod tumani, Izzat ko‘chasi, 89-uy",
      en: "89 Izzat St, Yashnobod District, Tashkent",
    },
    lat: 41.2697979,
    lng: 69.3433849,
  },
];

export function getBranch(id: string | null | undefined): Branch | null {
  return branches.find((b) => b.id === id) ?? null;
}

export function mapUrl(b: Pick<Branch, "lat" | "lng">) {
  return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
}

/** Distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
