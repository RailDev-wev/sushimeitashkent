import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/AdminApp";

export const metadata: Metadata = { title: "Админка · SUSHIMEI", robots: { index: false, follow: false } };

// Staff-only Mini App, opened from the bot (/admin). Access is checked on every API call.
export default function AdminPage() {
  return <AdminApp />;
}
