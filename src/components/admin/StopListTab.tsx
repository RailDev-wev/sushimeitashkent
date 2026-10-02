"use client";

import { useState } from "react";
import { haptic } from "@/lib/telegram";
import { adminFetch, type AdminState } from "./AdminApp";

type Props = { state: AdminState; onChange: (stopList: AdminState["stopList"]) => void };

export function StopListTab({ state, onChange }: Props) {
  const [branchId, setBranchId] = useState(state.branches[0].id);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopped = new Set(state.stopList[branchId] ?? []);
  const q = query.trim().toLowerCase();
  const visible = q ? state.items.filter((i) => i.name.toLowerCase().includes(q)) : state.items;

  async function toggle(itemId: string) {
    const available = stopped.has(itemId);
    const prev = state.stopList;
    const next = new Set(stopped);
    if (available) next.delete(itemId);
    else next.add(itemId);
    onChange({ ...prev, [branchId]: [...next] }); // optimistic
    setPending(itemId);
    setError(null);
    haptic();

    const res = await adminFetch("/api/admin/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, itemId, available }),
    }).catch(() => null);
    setPending(null);
    if (!res?.ok) {
      onChange(prev);
      setError("Не сохранилось, попробуйте ещё раз");
      haptic("error");
    }
  }

  return (
    <div className="space-y-4">
      {state.branches.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {state.branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchId(b.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                b.id === branchId ? "bg-text text-bg" : "bg-surface ring-1 ring-line"
              }`}
            >
              {b.name}
              {(state.stopList[b.id]?.length ?? 0) > 0 && <span className="ml-1 opacity-60">· {state.stopList[b.id].length}</span>}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-muted">
        Выключенные позиции клиенты видят как «Нет в наличии» и не могут заказать. Выключено: {stopped.size}
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск позиции"
        className="h-11 w-full rounded-xl bg-surface px-4 outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
      />

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}

      {state.categories.map((c) => {
        const items = visible.filter((i) => i.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id}>
            <h2 className="mb-2 px-1 font-bold">{c.name}</h2>
            <ul className="divide-y divide-line rounded-2xl bg-surface">
              {items.map((i) => {
                const on = !stopped.has(i.id);
                return (
                  <li key={i.id}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                      <span className={on ? "" : "text-muted line-through"}>{i.name}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={on}
                        disabled={pending === i.id}
                        onChange={() => toggle(i.id)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-disabled:opacity-60 peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${
                          on ? "bg-success" : "bg-line"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            on ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
