import { InlineKeyboard, webhookCallback, type Bot, type Context } from "grammy";
import { defaultLocale, matchLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isStaff } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { parseTake, takenKeyboard } from "@/lib/order-actions";
import { getSiteUrl } from "@/lib/site-url";
import { getBot } from "@/lib/telegram-server";

let handler: ((req: Request) => Promise<Response>) | null = null;

function setup(bot: Bot) {
  const siteUrl = getSiteUrl();

  /** Private chat only: Telegram doesn't allow Mini App buttons in groups. */
  async function sendAdminButton(ctx: Context) {
    if (!ctx.from || !(await isStaff(ctx.from.id))) {
      return ctx.reply("Админка доступна только участникам группы заказов.");
    }
    if (!siteUrl) return ctx.reply("Не задан адрес сайта.");
    return ctx.reply("Стоп-лист и рассылка:", {
      reply_markup: new InlineKeyboard().webApp("Открыть админку", `${siteUrl}/ru/admin`),
    });
  }

  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (ctx.match === "admin") return sendAdminButton(ctx);

    const locale = matchLocale(ctx.from?.language_code) ?? defaultLocale;
    const dict = getDictionary(locale);
    if (ctx.from) {
      // Everyone who starts the bot joins the customer base; /start also re-subscribes after /stop.
      await db.upsertCustomer(ctx.from).catch((err) => console.error("[bot] customer upsert failed", err));
      await db.setSubscribed(ctx.from.id, true).catch(() => {});
    }
    if (!siteUrl) return ctx.reply(dict.bot.start);

    const url = `${siteUrl}/${locale}`;
    await ctx.reply(dict.bot.start, {
      reply_markup: new InlineKeyboard().webApp(dict.bot.openMenu, url),
    });
    // Per-user menu button in their language (the global default is set by /api/bot/setup).
    await ctx.api
      .setChatMenuButton({ chat_id: ctx.chat.id, menu_button: { type: "web_app", text: dict.bot.menuButton, web_app: { url } } })
      .catch(() => {});
  });

  bot.command("stop", async (ctx) => {
    if (ctx.chat.type !== "private" || !ctx.from) return;
    await db.setSubscribed(ctx.from.id, false).catch((err) => console.error("[bot] unsubscribe failed", err));
    const dict = getDictionary(matchLocale(ctx.from.language_code) ?? defaultLocale);
    await ctx.reply(dict.bot.unsubscribed);
  });

  bot.command("admin", async (ctx) => {
    if (ctx.chat.type === "private") return sendAdminButton(ctx);
    // In the group: hand over to a private chat, where the Mini App button works.
    const me = ctx.me.username;
    await ctx.reply("Админка открывается в личке с ботом:", {
      reply_markup: new InlineKeyboard().url("Открыть", `https://t.me/${me}?start=admin`),
    });
  });

  // Helper for setup: add the bot to the staff group and send /chatid to get TELEGRAM_ORDERS_CHAT_ID.
  bot.command("chatid", (ctx) => ctx.reply(`chat id: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));

  // "Взять: <филиал>" under an order in the staff group.
  bot.on("callback_query:data", async (ctx) => {
    const branch = parseTake(ctx.callbackQuery.data);
    if (!branch) return ctx.answerCallbackQuery();

    const current = ctx.callbackQuery.message?.reply_markup?.inline_keyboard?.[0]?.[0];
    if (current && "callback_data" in current && current.callback_data === "noop") {
      return ctx.answerCallbackQuery({ text: "Заказ уже взят" });
    }
    const staff = ctx.from.first_name || (ctx.from.username ? `@${ctx.from.username}` : "сотрудник");
    await ctx.editMessageReplyMarkup({ reply_markup: takenKeyboard(branch.name.ru, staff) }).catch(() => {});
    await ctx.answerCallbackQuery({ text: `Заказ за филиалом «${branch.name.ru}»` });
  });

  return webhookCallback(bot, "std/http", { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET });
}

export async function POST(request: Request) {
  const bot = getBot();
  if (!bot) return new Response("bot not configured", { status: 503 });
  handler ??= setup(bot);
  return handler(request);
}
