"use client";

import { useMemo } from "react";
import { useCart, useHydrated } from "./cart-store";
import type { MenuItem } from "./menu-types";

const NONE = new Set<string>();

/**
 * Cart lines joined with the current menu. Items that left the menu are skipped; items the
 * selected branch switched off stay visible but are excluded from count, total and the order.
 */
export function useCartSummary(items: MenuItem[], unavailable: Set<string> = NONE) {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const unavailableKey = [...unavailable].sort().join();

  return useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const rows = hydrated
      ? Object.entries(lines).flatMap(([id, qty]) => {
          const item = byId.get(id);
          return item ? [{ item, qty, available: !unavailable.has(id) }] : [];
        })
      : [];
    const orderable = rows.filter((r) => r.available);
    const count = orderable.reduce((n, r) => n + r.qty, 0);
    const total = orderable.reduce((n, r) => n + r.qty * r.item.price, 0);
    const qtyOf = (id: string) => (hydrated ? (lines[id] ?? 0) : 0);
    return { rows, orderable, count, total, qtyOf, ready: hydrated };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content, not Set identity
  }, [items, lines, hydrated, unavailableKey]);
}
