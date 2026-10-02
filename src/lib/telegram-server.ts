import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Bot, GrammyError } from "grammy";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

const MAX_INIT_DATA_AGE_S = 24 * 60 * 60;

/**
 * Verifies Mini App initData per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the user only when the signature is valid, so it can't be spoofed from a browser.
 */
export function verifyInitData(initData: string, botToken: string): TelegramUser | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_INIT_DATA_AGE_S) return null;

  try {
    return JSON.parse(params.get("user") ?? "null");
  } catch {
    return null;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Staff group id from env; tolerant of stray spaces/quotes pasted into Vercel. */
export function getOrdersChatId(): string | null {
  const raw = process.env.TELEGRAM_ORDERS_CHAT_ID?.trim().replace(/^["']|["']$/g, "");
  return raw || null;
}

/** When a group is upgraded to a supergroup its id changes; Telegram reports the new one. */
export function migratedChatId(err: unknown): number | null {
  return err instanceof GrammyError ? (err.parameters.migrate_to_chat_id ?? null) : null;
}

let bot: Bot | null = null;

/** Shared grammY instance, or null when TELEGRAM_BOT_TOKEN isn't configured (local dev). */
export function getBot(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  bot ??= new Bot(token);
  return bot;
}
