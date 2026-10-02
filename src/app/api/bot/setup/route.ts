import { timingSafeEqual } from "node:crypto";
import type { Bot } from "grammy";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSiteUrl } from "@/lib/site-url";
import { db, hasDatabase } from "@/lib/db";
import { getBot, getOrdersChatId, migratedChatId } from "@/lib/telegram-server";

export const dynamic = "force-dynamic";

function secretMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * One-time bot setup, run from the deployed site so the token never has to leave Vercel:
 *   https://<site>/api/bot/setup?secret=<TELEGRAM_WEBHOOK_SECRET>
 * Registers the webhook, the Mini App menu button, commands and descriptions. Safe to re-run
 * (e.g. after switching to a custom domain).
 */
export async function GET(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Задайте TELEGRAM_WEBHOOK_SECRET в Vercel и сделайте Redeploy" }, { status: 503 });
  const given = new URL(request.url).searchParams.get("secret") ?? "";
  if (!secretMatches(given, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const bot = getBot();
  if (!bot) return Response.json({ error: "Задайте TELEGRAM_BOT_TOKEN в Vercel и сделайте Redeploy" }, { status: 503 });
  const siteUrl = getSiteUrl();
  if (!siteUrl?.startsWith("https://")) {
    return Response.json({ error: "Нет https-адреса сайта: задайте NEXT_PUBLIC_SITE_URL" }, { status: 503 });
  }

  const steps: Record<string, string> = {};
  async function step(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      steps[name] = "ok";
    } catch (err) {
      steps[name] = err instanceof Error ? err.message : String(err);
    }
  }

  const ru = getDictionary("ru");
  await step("webhook", () =>
    bot.api.setWebhook(`${siteUrl}/api/bot`, { secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }),
  );
  // Default menu button opens "/", which redirects to the user's language.
  await step("menuButton", () =>
    bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: ru.bot.menuButton, web_app: { url: siteUrl } } }),
  );
  for (const locale of locales) {
    const t = getDictionary(locale).bot;
    // Russian is the fallback for every other Telegram language.
    const language_code = locale === "ru" ? undefined : locale;
    await step(`texts:${locale}`, async () => {
      // Drop unscoped commands from earlier setups so customer commands don't show up in groups.
      await bot.api.deleteMyCommands({ language_code });
      await bot.api.setMyCommands(
        [
          { command: "start", description: t.commandStart },
          { command: "stop", description: t.commandStop },
        ],
        { language_code, scope: { type: "all_private_chats" } },
      );
      await bot.api.setMyShortDescription(t.shortDescription, { language_code });
      await bot.api.setMyDescription(t.description, { language_code });
    });
  }

  const me = await bot.api.getMe().catch(() => null);
  const ordersChat = getOrdersChatId();
  if (ordersChat) {
    // Staff commands appear only in the orders group.
    await step("groupCommands", () =>
      bot.api.setMyCommands(
        [
          { command: "admin", description: "Стоп-лист и рассылка" },
          { command: "chatid", description: "ID этого чата" },
        ],
        { scope: { type: "chat", chat_id: ordersChat } },
      ),
    );
  }
  const orders = ordersChat && me ? await checkOrdersChat(bot, ordersChat, me.id) : null;

  // Also creates the tables on first run.
  const database = !hasDatabase
    ? "не подключена: Vercel → Storage → Neon, затем Redeploy"
    : await db
        .listSubscribers()
        .then((s) => `ok, подписчиков: ${s.length}`)
        .catch((err) => `ошибка: ${err instanceof Error ? err.message : String(err)}`);

  return Response.json({
    bot: me ? `@${me.username}` : null,
    siteUrl,
    steps,
    database,
    ordersChat,
    ordersChatCheck: orders?.status ?? null,
    next: !ordersChat
      ? "Добавьте бота в группу заказов, отправьте там /chatid, впишите число в TELEGRAM_ORDERS_CHAT_ID в Vercel и сделайте Redeploy."
      : orders?.ok
        ? "Готово. Откройте бота в Telegram, нажмите /start и сделайте тестовый заказ."
        : orders?.fix ?? "Проверьте TELEGRAM_ORDERS_CHAT_ID.",
  });
}

/** Checks that the bot can post to the staff group without sending anything there. */
async function checkOrdersChat(bot: Bot, chatId: string, botId: number): Promise<{ ok: boolean; status: string; fix?: string }> {
  try {
    const chat = await bot.api.getChat(chatId);
    const member = await bot.api.getChatMember(chatId, botId);
    const title = "title" in chat ? chat.title : chatId;
    if (member.status === "left" || member.status === "kicked") {
      return { ok: false, status: `бот не состоит в «${title}»`, fix: "Добавьте бота в группу заказов и повторите заказ (Redeploy не нужен)." };
    }
    if (member.status === "restricted" && !member.can_send_messages) {
      return { ok: false, status: `боту запрещено писать в «${title}»`, fix: "Разрешите боту отправлять сообщения в группе." };
    }
    return { ok: true, status: `ok: «${title}», бот — ${member.status}` };
  } catch (err) {
    const newId = migratedChatId(err);
    if (newId) {
      return {
        ok: false,
        status: "группа стала супергруппой, у неё новый id",
        fix: `Замените TELEGRAM_ORDERS_CHAT_ID на ${newId} в Vercel и сделайте Redeploy.`,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: message,
      fix: "Telegram не видит эту группу: проверьте, что бот в ней есть, и заново получите id через /chatid.",
    };
  }
}
