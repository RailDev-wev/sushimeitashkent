"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/i18n/dictionaries";
import type { MenuCategory, MenuItem } from "@/lib/menu-types";
import { useMainButton, useIsTelegram } from "@/lib/telegram";
import { useCartSummary } from "@/lib/use-cart-summary";
import { ProductCard } from "./ProductCard";
import { useI18n } from "./Providers";

type Props = { categories: MenuCategory[]; items: MenuItem[] };

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

export function MenuView({ categories, items }: Props) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const isTelegram = useIsTelegram();
  const { count, total, qtyOf } = useCartSummary(items);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(categories[0]?.id);
  const navRef = useRef<HTMLDivElement>(null);

  const cartHref = `/${locale}/cart`;
  const cartLabel = `${dict.cart.open} В· ${formatPrice(total, dict)}`;
  useMainButton(count > 0 ? cartLabel : null, () => router.push(cartHref));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : null;
  }, [query, items]);

  // Highlight the category currently at the top of the viewport.
  useEffect(() => {
    if (results) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories, results]);

  // Keep the active chip visible in the horizontal nav.
  useEffect(() => {
    const nav = navRef.current;
    const chip = nav?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (nav && chip) nav.scrollTo({ left: chip.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <>
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="mx-auto max-w-6xl px-4 pt-2 pb-2">
          <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.menu.searchPlaceholder}
              className="h-full w-full bg-transparent outline-none placeholder:text-muted"
            />
          </label>
        </div>
        {!results && (
          <div ref={navRef} className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                data-cat={c.id}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                  active === c.id ? "bg-text text-bg" : "bg-surface text-text ring-1 ring-line"
                }`}
              >
                {c.name}
              </a>
            ))}
          </div>
        )}
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-10">
        {results ? (
          results.length ? (
            <div className={`${GRID} pt-2`}>
              {results.map((item) => (
                <ProductCard key={item.id} item={item} qty={qtyOf(item.id)} />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-muted">{dict.menu.searchEmpty}</p>
          )
        ) : (
          categories.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pt-4">
              <h2 className="mb-3 text-xl font-extrabold">{c.name}</h2>
              <div className={GRID}>
                {items
                  .filter((i) => i.category === c.id)
                  .map((item) => (
                    <ProductCard key={item.id} item={item} qty={qtyOf(item.id)} />
                  ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* In Telegram the native MainButton replaces this bar. */}
      {!isTelegram && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href={cartHref}
            className="mx-auto flex h-14 max-w-md items-center justify-between rounded-2xl bg-accent px-5 font-bold text-accent-fg shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-sm tabular-nums">{count}</span>
              {dict.cart.open}
            </span>
            <span className="tabular-nums">{formatPrice(total, dict)}</span>
          </Link>
        </div>
      )}
    </>
  );
}
