// Restaurant details shown on the site (taken from sushimei.clopos.menu). Fields set to null are hidden.
// Branch addresses live in ./branches.ts.
export const site = {
  name: "SUSHIMEI",
  phone: "+998 99 949 51 15" as string | null,
  hours: "8:00–23:00" as string | null, // every day
  instagram: { handle: "sushimei.uz", url: "https://www.instagram.com/sushimei.uz/" } as { handle: string; url: string } | null,
};

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
