import "server-only";
import { GrammyError, InlineKeyboard, InputFile, type Bot } from "grammy";
import { matchLocale, defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db, type Subscriber } from "./db";
import { getSiteUrl } from "./site-url";

const GAP_MS = 40; // ~25 msg/s, under Telegram's ~30/s broadcast limit
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BroadcastResult = { sent: number; blocked: number; failed: number };

/** Sends a promo (text, optional photo) with an "Open menu" button in each recipient's language. */
export async function broadcast(
  bot: Bot,
  recipients: Subscriber[],
  content: { text: string; photo?: { data: Uint8Array; name: string } },
): Promise<BroadcastResult> {
  const siteUrl = getSiteUrl();
  const result: BroadcastResult = { sent: 0, blocked: 0, failed: 0 };
  let photoId: string | null = null; // upload once, then reuse Telegram's file_id

  async function sendOne(r: Subscriber) {
    const locale = matchLocale(r.language) ?? defaultLocale;
    const dict = getDictionary(locale);
    const body = `${content.text}\n\n${dict.bot.broadcastFooter}`;
    const reply_markup = siteUrl ? new InlineKeyboard().webApp(dict.bot.openMenu, `${siteUrl}/${locale}`) : undefined;

    if (content.photo) {
      const photo = photoId ?? new InputFile(content.photo.data, content.photo.name);
      const msg = await bot.api.sendPhoto(r.id, photo, { caption: body, reply_markup });
      photoId ??= msg.photo.at(-1)?.file_id ?? null;
    } else {
      await bot.api.sendMessage(r.id, body, { reply_markup, link_preview_options: { is_disabled: true } });
    }
  }

  for (const r of recipients) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await sendOne(r);
        result.sent++;
        break;
      } catch (err) {
        if (err instanceof GrammyError && err.error_code === 429 && attempt === 0) {
          await sleep((err.parameters.retry_after ?? 1) * 1000);
          continue;
        }
        if (err instanceof GrammyError && err.error_code === 403) {
          // Blocked the bot or deleted their account: stop messaging them.
          result.blocked++;
          await db.setSubscribed(r.id, false).catch(() => {});
        } else {
          result.failed++;
          console.error(`[broadcast] failed for ${r.id}`, err);
        }
        break;
      }
    }
    await sleep(GAP_MS);
  }
  return result;
}
