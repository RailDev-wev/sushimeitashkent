import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getBranches, getMenu, getStopListSafe } from "@/lib/menu";
import { Header } from "@/components/Header";
import { MenuView } from "@/components/MenuView";
import { Footer } from "@/components/Footer";

export default async function MenuPage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { categories, items } = getMenu(lang);
  const stopList = await getStopListSafe();

  return (
    <>
      <Header />
      <MenuView categories={categories} items={items} branches={getBranches(lang)} stopList={stopList} />
      <Footer locale={lang} dict={getDictionary(lang)} />
      {/* room for the floating cart bar */}
      <div className="h-28" aria-hidden />
    </>
  );
}
