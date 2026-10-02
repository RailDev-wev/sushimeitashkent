import { InlineKeyboard, webhookCallback, type Bot } from "grammy";
import { defaultLocale, matchLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getBot } from "@/lib/telegram-server";

let handler: ((req: Request) => Promise<Response>) | null = null;

function setup(bot: Bot) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  bot.command("start", async (ctx) => {
    const locale = matchLocale(ctx.from?.language_code) ?? defaultLocale;
    const dict = getDictionary(locale);
    if (!siteUrl) return ctx.reply(dict.bot.start);

    const url = `${siteUrl}/${locale}`;
    await ctx.reply(dict.bot.start, {
      reply_markup: new InlineKeyboard().webApp(dict.bot.openMenu, url),
    });
    // Per-user menu button in their language (the global default is set by scripts/setup-bot.mjs).
    if (ctx.chat.type === "private") {
      await ctx.api
        .setChatMenuButton({ chat_id: ctx.chat.id, menu_button: { type: "web_app", text: dict.bot.openMenu, web_app: { url } } })
        .catch(() => {});
    }
  });

  // Helper for setup: add the bot to the staff group and send /chatid to get TELEGRAM_ORDERS_CHAT_ID.
  bot.command("chatid", (ctx) => ctx.reply(`chat id: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));

  return webhookCallback(bot, "std/http", { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET });
}

export async function POST(request: Request) {
  const bot = getBot();
  if (!bot) return new Response("bot not configured", { status: 503 });
  handler ??= setup(bot);
  return handler(request);
}
