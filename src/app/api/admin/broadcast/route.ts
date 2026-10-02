import { authAdmin } from "@/lib/admin-auth";
import { broadcast } from "@/lib/broadcast";
import { CAPTION_LIMIT, TEXT_LIMIT } from "@/lib/broadcast-limits";
import { db } from "@/lib/db";
import { getBot } from "@/lib/telegram-server";

// ~25 messages/s: a few thousand subscribers fit in this window.
export const maxDuration = 300;

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // Telegram's limit for photos

/**
 * Promo broadcast to everyone subscribed. multipart/form-data: text, optional photo,
 * test=1 to send only to the staff member who pressed the button.
 */
export async function POST(request: Request) {
  const user = await authAdmin(request);
  const bot = getBot();
  if (!user || !bot) return Response.json({ error: "forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const text = String(form?.get("text") ?? "").trim();
  const photo = form?.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  if (!text) return Response.json({ error: "Пустой текст" }, { status: 400 });
  const limit = hasPhoto ? CAPTION_LIMIT : TEXT_LIMIT;
  if (text.length > limit) return Response.json({ error: `Текст длиннее ${limit} символов` }, { status: 400 });
  if (hasPhoto && (photo.size > MAX_PHOTO_BYTES || !photo.type.startsWith("image/"))) {
    return Response.json({ error: "Фото должно быть картинкой до 10 МБ" }, { status: 400 });
  }

  const test = form?.get("test") === "1";
  const recipients = test ? [{ id: user.id, language: "ru" }] : await db.listSubscribers();
  const result = await broadcast(bot, recipients, {
    text,
    photo: hasPhoto ? { data: new Uint8Array(await photo.arrayBuffer()), name: photo.name || "promo.jpg" } : undefined,
  });

  if (!test) console.log(`[broadcast] by ${user.id}: ${JSON.stringify(result)}`);
  return Response.json({ ...result, total: recipients.length });
}
