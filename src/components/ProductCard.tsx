"use client";

import { format, formatPrice } from "@/i18n/dictionaries";
import type { MenuItem } from "@/lib/menu-types";
import { ItemImage } from "./ItemImage";
import { useI18n } from "./Providers";
import { QtyControl } from "./QtyControl";

export function ProductCard({ item, qty, soldOut = false }: { item: MenuItem; qty: number; soldOut?: boolean }) {
  const { dict } = useI18n();

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative">
        <ItemImage
          src={item.image}
          alt={item.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className={`aspect-[4/3] ${soldOut ? "opacity-40 grayscale" : ""}`}
        />
        {item.isNew && (
          <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">
            {dict.menu.new}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">{item.name}</h3>
        {item.pcs && <p className="text-xs text-muted">{format(dict.menu.pcs, { n: item.pcs })}</p>}
        <p className="mt-auto pt-1 text-base font-extrabold">{formatPrice(item.price, dict)}</p>
        <div className="pt-1">
          {soldOut ? (
            <p className="flex h-9 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-muted">
              {dict.menu.soldOut}
            </p>
          ) : (
            <QtyControl id={item.id} qty={qty} addLabel={dict.menu.add} size="sm" />
          )}
        </div>
      </div>
    </article>
  );
}
