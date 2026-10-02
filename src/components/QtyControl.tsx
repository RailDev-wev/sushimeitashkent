"use client";

import { useCart } from "@/lib/cart-store";
import { haptic } from "@/lib/telegram";

type Props = { id: string; qty: number; addLabel: string; size?: "sm" | "md" };

/** "Add" button that turns into a − n + stepper once the item is in the cart. */
export function QtyControl({ id, qty, addLabel, size = "md" }: Props) {
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const h = size === "sm" ? "h-9" : "h-10";

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => {
          add(id);
          haptic();
        }}
        className={`${h} w-full rounded-full bg-accent-soft px-4 text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-fg active:scale-[0.98]`}
      >
        {addLabel}
      </button>
    );
  }

  return (
    <div className={`${h} flex w-full items-center justify-between rounded-full bg-accent text-accent-fg`}>
      <button
        type="button"
        aria-label="−"
        onClick={() => {
          remove(id);
          haptic();
        }}
        className={`${h} w-10 text-xl font-bold leading-none`}
      >
        −
      </button>
      <span className="text-sm font-bold tabular-nums">{qty}</span>
      <button
        type="button"
        aria-label="+"
        onClick={() => {
          add(id);
          haptic();
        }}
        className={`${h} w-10 text-xl font-bold leading-none`}
      >
        +
      </button>
    </div>
  );
}
