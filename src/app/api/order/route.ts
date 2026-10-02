import { randomInt } from "node:crypto";
import { format, formatPrice, getDictionary } from "@/i18n/dictionaries";
import { getOrderableItem } from "@/lib/menu";
import { normalizePhone, orderSchema, type Order } from "@/lib/order-schema";
import { escapeHtml, getBot, verifyInitData, type TelegramUser } from "@/lib/telegram-server";

// Best-effort per-instance limit; enough to stop accidental double submits and casual spam.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const recent = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  recent.set(key, hits);
  return false;
}

const ORDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newOrderNo() {
  return Array.from({ length: 4 }, () => ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)]).join("");
}

type Line = { name: string; pcs?: number; qty: number; sum: number };

/** +998901234567 -> +998 90 123 45 67; other countries as is. */
function prettyPhone(phone: string) {
  const m = phone.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** Message for the staff group. Always in Russian regardless of the customer's language. */
function staffMessage(order: Order, orderNo: string, lines: Line[], total: number, phone: string, tgUser: TelegramUser | null) {
  const ru = getDictionary("ru");
  const e = escapeHtml;
  const out: string[] = [];

  out.push(`🍣 <b>Новый заказ #${orderNo}</b>`);
  out.push(`${tgUser ? "📱 Telegram" : "🌐 Сайт"} · ${order.locale.toUpperCase()}`);
  out.push("");
  out.push(`👤 ${e(order.name)}`);
  out.push(`📞 <a href="tel:${phone}">${prettyPhone(phone)}</a>`);
  if (tgUser) {
    out.push(
      tgUser.username
        ? `✈️ <a href="https://t.me/${e(tgUser.username)}">@${e(tgUser.username)}</a>`
        : `✈️ <a href="tg://user?id=${tgUser.id}">Профиль в Telegram</a>`,
    );
  }
  out.push("");

  if (order.deliveryType === "delivery") {
    out.push("🚚 <b>Доставка</b>");
    if (order.address) out.push(`📍 ${e(order.address)}`);
    if (order.details) out.push(`🏢 ${e(order.details)}`);
    if (order.location) {
      const { lat, lng } = order.location;
      out.push(
        `🗺 <a href="https://maps.google.com/?q=${lat},${lng}">Google Maps</a> · <a href="https://yandex.uz/maps/?pt=${lng},${lat}&z=17">Яндекс Карты</a>`,
      );
    }
  } else {
    out.push("🏃 <b>Самовывоз</b>");
  }
  out.push(`💳 Оплата при получении: ${order.payment === "cash" ? "наличными" : "картой"}`);
  out.push("");

  out.push("<b>Состав:</b>");
  for (const l of lines) {
    const pcs = l.pcs ? ` (${l.pcs} шт)` : "";
    out.push(`${l.qty} × ${e(l.name)}${pcs} — ${formatPrice(l.sum, ru)}`);
  }
  out.push("");
  out.push(`<b>Итого: ${formatPrice(total, ru)}</b>`);
  out.push("<i>Без учёта доставки</i>");

  if (order.comment) {
    out.push("");
    out.push(`💬 ${e(order.comment)}`);
  }
  return out.join("\n");
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const order = parsed.data;

  // Honeypot filled: pretend success so bots don't adapt.
  if (order.website) return Response.json({ orderNo: newOrderNo() });

  const phone = normalizePhone(order.phone);
  if (!phone) return Response.json({ error: "invalid" }, { status: 400 });

  if (rateLimited(ip)) return Response.json({ error: "rate_limit" }, { status: 429 });

  // Prices come from the server-side menu, never from the client.
  const lines: Line[] = [];
  for (const { id, qty } of order.items) {
    const item = getOrderableItem(id);
    if (!item) return Response.json({ error: "unavailable" }, { status: 409 });
    lines.push({ name: item.name.ru, pcs: item.pcs, qty, sum: item.price * qty });
  }
  const total = lines.reduce((n, l) => n + l.sum, 0);

  const bot = getBot();
  const tgUser = bot ? verifyInitData(order.initData, bot.token) : null;
  const orderNo = newOrderNo();
  const text = staffMessage(order, orderNo, lines, total, phone, tgUser);
  const chatId = process.env.TELEGRAM_ORDERS_CHAT_ID;

  if (!bot || !chatId) {
    // Local dev without a bot: print what would be sent.
    console.log(`[order] TELEGRAM_BOT_TOKEN / TELEGRAM_ORDERS_CHAT_ID not set, not sending:\n${text}`);
    return Response.json({ orderNo });
  }

  try {
    const sent = await bot.api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
    if (order.location) {
      await bot.api
        .sendLocation(chatId, order.location.lat, order.location.lng, {
          reply_parameters: { message_id: sent.message_id },
        })
        .catch((err) => console.error("[order] sendLocation failed", err));
    }
  } catch (err) {
    console.error("[order] failed to send to staff chat", err);
    return Response.json({ error: "server" }, { status: 502 });
  }

  if (tgUser) {
    const dict = getDictionary(order.locale);
    await bot.api
      .sendMessage(tgUser.id, format(dict.bot.orderReceived, { no: `#${orderNo}`, total: formatPrice(total, dict) }))
      .catch(() => {}); // the user may have blocked the bot; the order is already in the staff chat
  }

  return Response.json({ orderNo });
}
