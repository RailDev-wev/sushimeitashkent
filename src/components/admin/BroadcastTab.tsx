"use client";

import { useEffect, useState } from "react";
import { getTelegram, haptic } from "@/lib/telegram";
import { CAPTION_LIMIT, TEXT_LIMIT } from "@/lib/broadcast-limits";
import { adminFetch } from "./AdminApp";

type Result = { sent: number; blocked: number; failed: number; total: number };

function confirmAsync(message: string): Promise<boolean> {
  const tg = getTelegram();
  if (tg?.showConfirm) return new Promise((resolve) => tg.showConfirm?.(message, resolve));
  return Promise.resolve(window.confirm(message));
}

export function BroadcastTab({ subscribers }: { subscribers: number }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState<"test" | "all" | null>(null);
  const [result, setResult] = useState<{ test: boolean; data: Result } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choosePhoto(file: File | null) {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }
  // Free the previous blob URL whenever the preview changes or the tab unmounts.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const limit = photo ? CAPTION_LIMIT : TEXT_LIMIT;
  const tooLong = text.length > limit;
  const canSend = text.trim().length > 0 && !tooLong && !sending;

  async function send(test: boolean) {
    if (!canSend) return;
    if (!test && !(await confirmAsync(`Отправить рассылку ${subscribers} подписчикам? Отменить будет нельзя.`))) return;

    const form = new FormData();
    form.set("text", text);
    if (photo) form.set("photo", photo);
    if (test) form.set("test", "1");

    setSending(test ? "test" : "all");
    setError(null);
    setResult(null);
    try {
      const res = await adminFetch("/api/admin/broadcast", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не удалось отправить");
      setResult({ test, data });
      haptic("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
      haptic("error");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Подписчиков: <b className="text-text">{subscribers}</b>. Это клиенты, которые запускали бота или заказывали через
        Telegram. Под сообщением будет кнопка «Открыть меню» и подпись, как отписаться.
      </p>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Например: 🔥 Только сегодня −20% на все сеты!"
          className="w-full resize-none rounded-xl bg-surface px-4 py-3 outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <p className={`px-1 text-right text-xs ${tooLong ? "font-semibold text-danger" : "text-muted"}`}>
          {text.length} / {limit}
          {photo && " (с фото подпись короче)"}
        </p>
      </div>

      <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
        {preview ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
            <span className="min-w-0 flex-1 truncate text-sm">{photo?.name}</span>
            <button type="button" onClick={() => choosePhoto(null)} className="text-sm font-semibold text-danger">
              Убрать
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-accent">
            + Добавить фото (необязательно)
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      {result && (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {result.test
            ? "Тест отправлен вам в личку с ботом."
            : `Готово: доставлено ${result.data.sent} из ${result.data.total}` +
              (result.data.blocked ? `, заблокировали бота ${result.data.blocked} (отписаны)` : "") +
              (result.data.failed ? `, ошибок ${result.data.failed}` : "")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => send(true)}
          disabled={!canSend}
          className="h-12 rounded-xl bg-surface font-semibold ring-1 ring-line disabled:opacity-50"
        >
          {sending === "test" ? "Отправляем…" : "Тест себе"}
        </button>
        <button
          type="button"
          onClick={() => send(false)}
          disabled={!canSend || subscribers === 0}
          className="h-12 rounded-xl bg-accent font-bold text-accent-fg disabled:opacity-50"
        >
          {sending === "all" ? "Отправляем…" : `Всем (${subscribers})`}
        </button>
      </div>
      {sending === "all" && <p className="text-center text-xs text-muted">Не закрывайте админку до конца отправки.</p>}
    </div>
  );
}
