import { phoneHref, site } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type Row = { label: string; value: string; href?: string; external?: boolean };

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const rows = [
    site.hours && { label: dict.footer.hours, value: `${dict.footer.daily}, ${site.hours}` },
    site.phone && { label: dict.footer.phone, value: site.phone, href: phoneHref(site.phone) },
    site.address && { label: dict.footer.address, value: site.address[locale], href: site.mapUrl ?? undefined, external: true },
    site.instagram && { label: "Instagram", value: `@${site.instagram.handle}`, href: site.instagram.url, external: true },
  ].filter(Boolean) as Row[];

  if (!rows.length) return null;

  return (
    <footer className="mx-auto max-w-6xl px-4 text-sm text-muted">
      <dl className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs uppercase tracking-wide">{r.label}</dt>
            <dd className="mt-0.5 font-semibold text-text">
              {r.href ? (
                <a
                  href={r.href}
                  {...(r.external && { target: "_blank", rel: "noopener noreferrer" })}
                  className="underline-offset-4 hover:text-accent hover:underline"
                >
                  {r.value}
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </footer>
  );
}
