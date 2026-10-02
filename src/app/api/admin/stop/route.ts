import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBranch } from "@/config/branches";
import { authStaff } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getOrderableItem } from "@/lib/menu";

const schema = z.object({ branchId: z.string(), itemId: z.string(), available: z.boolean() });

/** Switches an item on/off for one branch and refreshes the static menu pages. */
export async function POST(request: Request) {
  const user = await authStaff(request);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !getBranch(parsed.data.branchId) || !getOrderableItem(parsed.data.itemId)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const { branchId, itemId, available } = parsed.data;
  await db.setAvailable(branchId, itemId, available, user.id);
  revalidatePath("/[lang]", "layout");
  return Response.json({ ok: true });
}
