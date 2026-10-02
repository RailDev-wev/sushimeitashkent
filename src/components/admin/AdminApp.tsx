"use client";

import { useEffect, useState } from "react";
import { getTelegram, haptic, useIsTelegram } from "@/lib/telegram";
import { BroadcastTab } from "./BroadcastTab";
import { StopListTab } from "./StopListTab";

export type AdminState = {
  me: { name: string };
  hasDatabase: boolean;
  branches: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  items: { id: string; category: string; name: string }[];
  stopList: Record<string, string[]>;
  subscribers: number;
};

/** fetch() for admin APIs: signs every request with the Mini App's initData. */
export function adminFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-telegram-init-data", getTelegram()?.initData ?? "");
  return fetch(path, { ...init, headers });
}

export function AdminApp() {
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"stop" | "broadcast">("stop");
  const inTelegram = useIsTelegram();

  useEffect(() => {
    if (!getTelegram()) return;
    adminFetch("/api/admin/state")
      .then(async (res) => {
        if (res.status === 403) throw new Error("Нет доступа: админка только для участников группы заказов.");
        if (!res.ok) throw new Error("Не удалось загрузить данные. Попробуйте ещё раз.");
        setState(await res.json());
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (!inTelegram) {
    return <Notice>Админка открывается из Telegram: напишите боту /admin.</Notice>;
  }
  if (error) return <Notice>{error}</Notice>;
  if (!state) return <Notice>Загрузка…</Notice>;

  return (
    <main className="mx-auto max-w-xl px-4 pt-4 pb-16">
      <h1 className="text-2xl font-extrabold">Админка</h1>
      <p className="text-sm text-muted">{state.me.name}</p>

      {!state.hasDatabase && (
        <p className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          База данных не подключена — изменения не сохранятся после перезапуска.
        </p>
      )}

      <div className="my-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
        {(
          [
            ["stop", "Стоп-лист"],
            ["broadcast", "Рассылка"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              haptic();
            }}
            className={`h-10 rounded-lg text-sm font-semibold ${tab === id ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "stop" ? (
        <StopListTab state={state} onChange={(stopList) => setState({ ...state, stopList })} />
      ) : (
        <BroadcastTab subscribers={state.subscribers} />
      )}
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-[60dvh] max-w-md items-center justify-center px-6 text-center text-muted">{children}</main>;
}
