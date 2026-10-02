import { branches } from "@/config/branches";
import { authAdmin } from "@/lib/admin-auth";
import { db, hasDatabase } from "@/lib/db";
import { getAllItemsRu, getMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";

/** Everything the admin Mini App needs on load. */
export async function GET(request: Request) {
  const user = await authAdmin(request);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });

  const [stopList, subscribers] = await Promise.all([db.getStopList(), db.listSubscribers()]);
  return Response.json({
    me: { name: [user.first_name, user.last_name].filter(Boolean).join(" ") },
    hasDatabase,
    branches: branches.map((b) => ({ id: b.id, name: b.name.ru })),
    categories: getMenu("ru").categories,
    items: getAllItemsRu(),
    stopList,
    subscribers: subscribers.length,
  });
}
