/**
 * Public https URL of the site, without a trailing slash.
 * NEXT_PUBLIC_SITE_URL wins (custom domain); otherwise the production domain Vercel provides.
 */
export function getSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : null;
}
