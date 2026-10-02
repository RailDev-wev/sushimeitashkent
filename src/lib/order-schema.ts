import { z } from "zod";
import { locales } from "@/i18n/config";

/** Strips formatting; accepts local 9-digit Uzbek numbers and international ones. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 9) digits = `998${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export const orderSchema = z
  .object({
    items: z
      .array(z.object({ id: z.string().max(80), qty: z.number().int().min(1).max(50) }))
      .min(1)
      .max(60),
    /** Empty from clients that predate branches; the server falls back to the first branch. */
    branchId: z.string().max(40).default(""),
    name: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(30),
    deliveryType: z.enum(["delivery", "pickup"]),
    address: z.string().trim().max(300).default(""),
    details: z.string().trim().max(200).default(""),
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().default(null),
    payment: z.enum(["cash", "card"]),
    comment: z.string().trim().max(500).default(""),
    locale: z.enum(locales),
    /** Telegram WebApp initData, verified on the server */
    initData: z.string().max(4096).default(""),
    /** Honeypot: real users never fill this */
    website: z.string().max(200).default(""),
  })
  .refine((o) => o.deliveryType === "pickup" || o.address.length > 0 || o.location !== null, {
    path: ["address"],
    message: "required",
  });

export type OrderInput = z.input<typeof orderSchema>;
export type Order = z.output<typeof orderSchema>;
