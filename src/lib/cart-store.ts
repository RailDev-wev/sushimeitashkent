"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_QTY = 50;

type CartState = {
  /** item id -> quantity */
  lines: Record<string, number>;
  add: (id: string) => void;
  remove: (id: string) => void;
  /** Removes the line whatever its quantity. */
  drop: (id: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: {},
      add: (id) =>
        set((s) => ({ lines: { ...s.lines, [id]: Math.min((s.lines[id] ?? 0) + 1, MAX_QTY) } })),
      remove: (id) =>
        set((s) => {
          const qty = (s.lines[id] ?? 0) - 1;
          const lines = { ...s.lines };
          if (qty > 0) lines[id] = qty;
          else delete lines[id];
          return { lines };
        }),
      drop: (id) =>
        set((s) => {
          const lines = { ...s.lines };
          delete lines[id];
          return { lines };
        }),
      clear: () => set({ lines: {} }),
    }),
    { name: "sushimei-cart" },
  ),
);

export type CustomerDraft = {
  name: string;
  phone: string;
  deliveryType: "delivery" | "pickup";
  address: string;
  details: string;
  payment: "cash" | "card";
  branchId: string | null;
  /** True once the customer picked a branch themselves; then location no longer overrides it. */
  branchManual: boolean;
};

type CustomerState = CustomerDraft & { update: (patch: Partial<CustomerDraft>) => void };

/** Remembers contact details so returning customers don't retype them. */
export const useCustomer = create<CustomerState>()(
  persist(
    (set) => ({
      name: "",
      phone: "",
      deliveryType: "delivery",
      address: "",
      details: "",
      payment: "cash",
      branchId: null,
      branchManual: false,
      update: (patch) => set(patch),
    }),
    { name: "sushimei-customer" },
  ),
);

/** Persisted stores load from localStorage after hydration; gate cart-dependent UI on this. */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}

/** Last known customer location for this session only (not persisted). */
export const useLocationStore = create<{
  location: { lat: number; lng: number } | null;
  setLocation: (l: { lat: number; lng: number } | null) => void;
}>()((set) => ({ location: null, setLocation: (location) => set({ location }) }));
