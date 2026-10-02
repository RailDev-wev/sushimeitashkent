import "server-only";
import { getBot, getOrdersChatId, verifyInitData, type TelegramUser } from "./telegram-server";

// Staff = members of the orders group. No passwords or id lists to maintain: removing someone
// from the group revokes access (within the cache window).
const CACHE_MS = 60_000;
const cache = new Map<number, { ok: boolean; at: number }>();

export async function isStaff(userId: number): Promise<boolean> {
  const bot = getBot();
  const chatId = getOrdersChatId();
  if (!bot || !chatId) return false;

  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ok;

  let ok = false;
  try {
    const m = await bot.api.getChatMember(chatId, userId);
    ok = ["creator", "administrator", "member"].includes(m.status) || (m.status === "restricted" && m.is_member);
  } catch {
    ok = false;
  }
  cache.set(userId, { ok, at: Date.now() });
  return ok;
}

export const INIT_DATA_HEADER = "x-telegram-init-data";

/** Staff user behind an admin API request, or null. The Mini App sends its signed initData in a header. */
export async function authStaff(request: Request): Promise<TelegramUser | null> {
  const bot = getBot();
  if (!bot) return null;
  const user = verifyInitData(request.headers.get(INIT_DATA_HEADER) ?? "", bot.token);
  return user && (await isStaff(user.id)) ? user : null;
}
