"use client";

import { useMemo } from "react";
import { useCart, useHydrated } from "./cart-store";
import type { MenuItem } from "./menu-types";

/** Cart lines joined with the current menu. Items that left the menu are skipped. */
export function useCartSummary(items: MenuItem[]) {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);

  return useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const rows = hydrated
      ? Object.entries(lines).flatMap(([id, qty]) => {
          const item = byId.get(id);
          return item ? [{ item, qty }] : [];
        })
      : [];
    const count = rows.reduce((n, r) => n + r.qty, 0);
    const total = rows.reduce((n, r) => n + r.qty * r.item.price, 0);
    const qtyOf = (id: string) => (hydrated ? (lines[id] ?? 0) : 0);
    return { rows, count, total, qtyOf, ready: hydrated };
  }, [items, lines, hydrated]);
}
