import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { hasLocale } from "@/i18n/config";
import { getBranches, getMenu, getStopListSafe } from "@/lib/menu";
import { Checkout } from "@/components/Checkout";

export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { items } = getMenu(lang);
  const stopList = await getStopListSafe();

  return <Checkout items={items} branches={getBranches(lang)} stopList={stopList} phone={site.phone} />;
}
