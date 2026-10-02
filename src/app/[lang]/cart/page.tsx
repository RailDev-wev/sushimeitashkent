import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { hasLocale } from "@/i18n/config";
import { getMenu } from "@/lib/menu";
import { Checkout } from "@/components/Checkout";

export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { items } = getMenu(lang);

  return <Checkout items={items} pickupAddress={site.address?.[lang] ?? null} mapUrl={site.mapUrl} phone={site.phone} />;
}
