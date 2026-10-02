import { timingSafeEqual } from "node:crypto";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSiteUrl } from "@/lib/site-url";
import { getBot } from "@/lib/telegram-server";

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
    bot.api.setWebhook(`${siteUrl}/api/bot`, { secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true }),
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
      await bot.api.setMyCommands([{ command: "start", description: t.commandStart }], { language_code });
      await bot.api.setMyShortDescription(t.shortDescription, { language_code });
      await bot.api.setMyDescription(t.description, { language_code });
    });
  }

  const me = await bot.api.getMe().catch(() => null);
  const ordersChat = process.env.TELEGRAM_ORDERS_CHAT_ID;

  return Response.json({
    bot: me ? `@${me.username}` : null,
    siteUrl,
    steps,
    ordersChat: ordersChat ?? null,
    next: ordersChat
      ? "Готово. Откройте бота в Telegram и нажмите /start."
      : "Добавьте бота в группу заказов, отправьте там /chatid, впишите число в TELEGRAM_ORDERS_CHAT_ID в Vercel и сделайте Redeploy.",
  });
}
