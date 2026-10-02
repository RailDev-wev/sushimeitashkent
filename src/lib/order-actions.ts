import "server-only";
import { InlineKeyboard } from "grammy";
import { branches, getBranch } from "@/config/branches";

// Buttons under each order in the staff group: whichever branch has capacity takes the order.
const TAKE = "take:";

export function takeKeyboard() {
  const kb = new InlineKeyboard();
  branches.forEach((b, i) => {
    kb.text(`Взять: ${b.name.ru}`, `${TAKE}${b.id}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

/** Branch from a "take" button's callback data, or null for anything else. */
export function parseTake(data: string | undefined) {
  return data?.startsWith(TAKE) ? getBranch(data.slice(TAKE.length)) : null;
}

/** Replaces the buttons with a single inert "taken by" label. */
export function takenKeyboard(branchName: string, staffName: string) {
  return new InlineKeyboard().text(`✅ ${branchName} · ${staffName}`, "noop");
}
