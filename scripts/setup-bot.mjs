// One-time (and after each domain change) bot setup: webhook, menu button, commands, descriptions.
// Usage: node --env-file=.env.local scripts/setup-bot.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !siteUrl || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_SITE_URL and TELEGRAM_WEBHOOK_SECRET first.");
  process.exit(1);
}
if (!siteUrl.startsWith("https://")) {
  console.error("Telegram requires an https:// NEXT_PUBLIC_SITE_URL.");
  process.exit(1);
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(`${data.ok ? "ok  " : "FAIL"} ${method}${data.ok ? "" : `: ${data.description}`}`);
  if (!data.ok) process.exitCode = 1;
}

const texts = {
  ru: { button: "Меню", start: "Открыть меню", short: "Доставка суши и роллов SUSHIMEI", description: "Меню, корзина и заказ в пару касаний. Оператор перезвонит для подтверждения." },
  uz: { button: "Menyu", start: "Menyuni ochish", short: "SUSHIMEI — sushi va rollar yetkazib berish", description: "Menyu, savat va bir necha bosishda buyurtma. Operator tasdiqlash uchun qo‘ng‘iroq qiladi." },
  en: { button: "Menu", start: "Open menu", short: "SUSHIMEI sushi & rolls delivery", description: "Menu, cart and ordering in a few taps. Our operator will call you to confirm." },
};

await call("setWebhook", {
  url: `${siteUrl}/api/bot`,
  secret_token: secret,
  allowed_updates: ["message"],
  drop_pending_updates: true,
});

// Default menu button: "/" redirects to the user's language.
await call("setChatMenuButton", { menu_button: { type: "web_app", text: texts.ru.button, web_app: { url: siteUrl } } });

for (const [lang, t] of Object.entries(texts)) {
  const language_code = lang === "ru" ? undefined : lang;
  await call("setMyCommands", { commands: [{ command: "start", description: t.start }], language_code });
  await call("setMyShortDescription", { short_description: t.short, language_code });
  await call("setMyDescription", { description: t.description, language_code });
}
