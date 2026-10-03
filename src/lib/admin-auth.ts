import "server-only";
import { getBot, getOrdersChatId, verifyInitData, type TelegramUser } from "./telegram-server";

// Admin = owner or administrator of the orders group. Access is managed with ordinary Telegram
// admin rights: no passwords or id lists, and demoting someone revokes it (within the cache window).
// Regular members (cooks, couriers) can still take orders in the group but can't open the admin panel.
const CACHE_MS = 60_000;
const cache = new Map<number, { ok: boolean; at: number }>();

const STATUS_RU: Record<string, string> = {
  creator: "владелец",
  administrator: "администратор",
  member: "участник (не админ)",
  restricted: "ограниченный участник",
  left: "не состоит в группе",
  kicked: "удалён из группы",
};

/** The user's role in the orders group as Telegram reports it, in Russian (for "access denied" replies). */
export async function describeGroupStatus(userId: number): Promise<string> {
  const bot = getBot();
  const chatId = getOrdersChatId();
  if (!bot || !chatId) return "группа заказов не настроена";
  try {
    const m = await bot.api.getChatMember(chatId, userId);
    return STATUS_RU[m.status] ?? m.status;
  } catch (err) {
    return `не удалось проверить (${err instanceof Error ? err.message : String(err)})`;
  }
}

export async function isAdmin(userId: number): Promise<boolean> {
  const bot = getBot();
  const chatId = getOrdersChatId();
  if (!bot || !chatId) return false;

  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ok;

  let ok = false;
  try {
    const m = await bot.api.getChatMember(chatId, userId);
    ok = m.status === "creator" || m.status === "administrator";
  } catch (err) {
    console.error(`[admin] getChatMember failed for ${userId}`, err);
    // Don't cache failures: a Telegram hiccup shouldn't lock admins out for a minute.
    return false;
  }
  cache.set(userId, { ok, at: Date.now() });
  return ok;
}

export const INIT_DATA_HEADER = "x-telegram-init-data";

/** Admin behind an admin API request, or null. The Mini App sends its signed initData in a header. */
export async function authAdmin(request: Request): Promise<TelegramUser | null> {
  const bot = getBot();
  if (!bot) return null;
  const user = verifyInitData(request.headers.get(INIT_DATA_HEADER) ?? "", bot.token);
  return user && (await isAdmin(user.id)) ? user : null;
}

/** Why an admin API request was refused, for the Mini App to show. */
export async function deniedReason(request: Request): Promise<string> {
  const bot = getBot();
  const user = bot ? verifyInitData(request.headers.get(INIT_DATA_HEADER) ?? "", bot.token) : null;
  if (!user) return "не удалось подтвердить Telegram-аккаунт — откройте админку заново через /admin";
  return `ваш статус в группе заказов: ${await describeGroupStatus(user.id)}`;
}
