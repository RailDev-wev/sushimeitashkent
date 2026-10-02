"use client";

import { createContext, useContext, useEffect } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { localeCookie, type Locale } from "@/i18n/config";
import { getTelegram } from "@/lib/telegram";

type I18n = { locale: Locale; dict: Dictionary };
const I18nContext = createContext<I18n | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside Providers");
  return ctx;
}

export function Providers({ locale, dict, children }: I18n & { children: React.ReactNode }) {
  useEffect(() => {
    document.cookie = `${localeCookie}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  useEffect(() => {
    const tg = getTelegram();
    if (!tg) return;
    const root = document.documentElement;
    root.dataset.tg = "";

    const applyTheme = () => {
      root.dataset.theme = tg.colorScheme;
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      try {
        // Older Telegram clients reject custom colours; the default theme is fine there.
        tg.setHeaderColor(bg);
        tg.setBackgroundColor(bg);
        tg.setBottomBarColor?.(bg);
      } catch {}
    };
    applyTheme();
    tg.onEvent("themeChanged", applyTheme);
    tg.ready();
    tg.expand();
    return () => tg.offEvent("themeChanged", applyTheme);
  }, []);

  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}
