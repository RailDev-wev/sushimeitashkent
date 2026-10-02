import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, localeCookie, locales, matchLocale } from "@/i18n/config";

function pickLocale(request: NextRequest) {
  const fromCookie = request.cookies.get(localeCookie)?.value;
  if (hasLocale(fromCookie)) return fromCookie;
  const accepted = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim());
  for (const code of accepted) {
    const match = matchLocale(code);
    if (match) return match;
  }
  return defaultLocale;
}

/** Sends locale-less URLs (e.g. the bot's "/") to /ru, /uz or /en. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasPrefix = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasPrefix) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${pickLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals and any file with an extension (images, favicon, etc.)
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
