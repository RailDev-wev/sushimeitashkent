"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// Only the parts of https://core.telegram.org/bots/webapps we use.
type BottomButton = {
  setParams: (p: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
};

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; last_name?: string; language_code?: string } };
  colorScheme: "light" | "dark";
  version: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast: (v: string) => boolean;
  setHeaderColor: (c: string) => void;
  setBackgroundColor: (c: string) => void;
  setBottomBarColor?: (c: string) => void;
  onEvent: (e: string, cb: () => void) => void;
  offEvent: (e: string, cb: () => void) => void;
  requestContact: (cb: (shared: boolean, res?: { responseUnsafe?: { contact?: { phone_number?: string } } }) => void) => void;
  MainButton: BottomButton;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback?: {
    impactOccurred: (s: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (t: "error" | "success" | "warning") => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** The WebApp object, but only when actually opened from Telegram (initData is empty in a normal browser). */
export function getTelegram(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram?.WebApp;
  return tg && tg.initData ? tg : null;
}

const noopSubscribe = () => () => {};

/** True inside Telegram. False during SSR and in a normal browser. */
export function useIsTelegram() {
  return useSyncExternalStore(noopSubscribe, () => getTelegram() !== null, () => false);
}

export function haptic(kind: "light" | "success" | "error" = "light") {
  const h = getTelegram()?.HapticFeedback;
  if (!h) return;
  if (kind === "light") h.impactOccurred("light");
  else h.notificationOccurred(kind);
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Telegram's bottom MainButton. Hidden when `text` is null. */
export function useMainButton(text: string | null, onClick: () => void, opts: { loading?: boolean; disabled?: boolean } = {}) {
  const handler = useRef(onClick);
  useEffect(() => {
    handler.current = onClick;
  });

  useEffect(() => {
    const tg = getTelegram();
    if (!tg) return;
    const cb = () => handler.current();
    tg.MainButton.onClick(cb);
    return () => {
      tg.MainButton.offClick(cb);
      tg.MainButton.setParams({ is_visible: false });
    };
  }, []);

  useEffect(() => {
    const tg = getTelegram();
    if (!tg) return;
    if (text === null) {
      tg.MainButton.setParams({ is_visible: false });
      return;
    }
    tg.MainButton.setParams({
      text,
      color: cssVar("--accent"),
      text_color: cssVar("--accent-fg"),
      is_visible: true,
      is_active: !opts.disabled && !opts.loading,
    });
    if (opts.loading) tg.MainButton.showProgress();
    else tg.MainButton.hideProgress();
  }, [text, opts.loading, opts.disabled]);
}

/** Telegram's native back button in the header. */
export function useBackButton(onBack: (() => void) | null) {
  const handler = useRef(onBack);
  useEffect(() => {
    handler.current = onBack;
  });
  const enabled = onBack !== null;

  useEffect(() => {
    const tg = getTelegram();
    if (!tg || !enabled) return;
    const cb = () => handler.current?.();
    tg.BackButton.onClick(cb);
    tg.BackButton.show();
    return () => {
      tg.BackButton.offClick(cb);
      tg.BackButton.hide();
    };
  }, [enabled]);
}
