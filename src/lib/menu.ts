import "server-only";
import { readdirSync } from "node:fs";
import path from "node:path";
import menuData from "@/data/menu.json";
import type { Locale } from "@/i18n/config";
import { branches, mapUrl } from "@/config/branches";
import { db } from "./db";
import type { BranchInfo, MenuCategory, MenuItem, StopList } from "./menu-types";

type RawItem = {
  id: string;
  category: string;
  name: Record<Locale, string>;
  price: number | null;
  pcs?: number;
  isNew?: boolean;
  hidden?: boolean;
};

const raw = menuData as { categories: { id: string; name: Record<Locale, string> }[]; items: RawItem[] };

const IMAGE_DIR = path.join(process.cwd(), "public", "menu");
const IMAGE_EXT = [".webp", ".jpg", ".jpeg", ".png", ".avif"];

/** Photos are matched by file name: public/menu/<item id>.(webp|jpg|png|avif). */
function findImages(): Map<string, string> {
  const map = new Map<string, string>();
  let files: string[] = [];
  try {
    files = readdirSync(IMAGE_DIR);
  } catch {
    return map;
  }
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (IMAGE_EXT.includes(ext)) map.set(path.basename(file, path.extname(file)), `/menu/${file}`);
  }
  return map;
}

function isOrderable(item: RawItem): item is RawItem & { price: number } {
  return !item.hidden && typeof item.price === "number" && item.price > 0;
}

/** Orderable items only, with names resolved for the locale. Empty categories are dropped. */
export function getMenu(locale: Locale): { categories: MenuCategory[]; items: MenuItem[] } {
  const images = findImages();
  const items: MenuItem[] = raw.items.filter(isOrderable).map((item) => ({
    id: item.id,
    category: item.category,
    name: item.name[locale] ?? item.name.ru,
    price: item.price,
    pcs: item.pcs,
    isNew: item.isNew,
    image: images.get(item.id),
  }));
  const used = new Set(items.map((i) => i.category));
  const categories = raw.categories
    .filter((c) => used.has(c.id))
    .map((c) => ({ id: c.id, name: c.name[locale] ?? c.name.ru }));
  return { categories, items };
}

/** Server-side price source of truth for orders. */
export function getOrderableItem(id: string) {
  const item = raw.items.find((i) => i.id === id);
  return item && isOrderable(item) ? item : null;
}

export function getBranches(locale: Locale): BranchInfo[] {
  return branches.map((b) => ({
    id: b.id,
    name: b.name[locale],
    address: b.address[locale],
    lat: b.lat,
    lng: b.lng,
    mapUrl: mapUrl(b),
  }));
}

/** Stop-list for rendering. A database hiccup shouldn't take the menu down, so it degrades to "all available". */
export async function getStopListSafe(): Promise<StopList> {
  try {
    return await db.getStopList();
  } catch (err) {
    console.error("[menu] failed to load stop-list", err);
    return {};
  }
}

/** All orderable items regardless of branch, with Russian names (admin panel). */
export function getAllItemsRu() {
  return raw.items.filter(isOrderable).map((i) => ({ id: i.id, category: i.category, name: i.name.ru }));
}
