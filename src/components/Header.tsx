"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { phoneHref, site } from "@/config/site";
import { localeLabels, locales } from "@/i18n/config";
import { useI18n } from "./Providers";
import { Logo } from "./Logo";

export function Header() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const rest = pathname.replace(/^\/[^/]+/, "");

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-4 pb-2">
      <Link href={`/${locale}`} aria-label="SUSHIMEI">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        {site.phone && (
          <a
            href={phoneHref(site.phone)}
            aria-label={dict.footer.call}
            className="flex h-9 items-center gap-2 rounded-full bg-surface-2 px-3 text-sm font-semibold hover:text-accent"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
            <span className="hidden sm:inline">{site.phone}</span>
          </a>
        )}
        <nav className="flex rounded-full bg-surface-2 p-1 text-sm font-semibold" aria-label="Language">
          {locales.map((l) => (
            <Link
              key={l}
              href={`/${l}${rest}`}
              replace
              scroll={false}
              aria-current={l === locale ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                l === locale ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
              }`}
            >
              {localeLabels[l]}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
