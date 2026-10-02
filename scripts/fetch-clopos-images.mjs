// Downloads the restaurant's current product photos from the Clopos CDN into public/menu/<id>.jpg.
// Optional: only for demos until the real photos are dropped into public/menu.
// Usage: node scripts/fetch-clopos-images.mjs [--force]
import { readFile, writeFile, mkdir, access } from "node:fs/promises";

const map = JSON.parse(await readFile(new URL("./clopos-images.json", import.meta.url), "utf8"));
const outDir = new URL("../public/menu/", import.meta.url);
const force = process.argv.includes("--force");
await mkdir(outDir, { recursive: true });

let saved = 0;
for (const [id, uuid] of Object.entries(map)) {
  const target = new URL(`${id}.jpg`, outDir);
  if (!force && (await access(target).then(() => true, () => false))) continue;
  const res = await fetch(`https://cdn-2.clopos.com/sushimei/${uuid}/card43@3x.jpg`);
  if (!res.ok) {
    console.warn(`skip ${id}: HTTP ${res.status}`);
    continue;
  }
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  saved++;
}
console.log(`saved ${saved} images to public/menu`);
