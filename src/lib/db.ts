import "server-only";
import { neon } from "@neondatabase/serverless";
import type { StopList } from "./menu-types";
import type { TelegramUser } from "./telegram-server";

/**
 * Storage for runtime data: per-branch stop-list and the Telegram customer base.
 * Postgres (Neon, via Vercel Marketplace) when DATABASE_URL is set; in-memory otherwise so
 * local dev works without a database (data is lost on restart).
 */
export type Subscriber = { id: number; language: string | null };

type Store = {
  getStopList(): Promise<StopList>;
  setAvailable(branchId: string, itemId: string, available: boolean, by: number): Promise<void>;
  upsertCustomer(user: TelegramUser, extra?: { phone?: string; ordered?: boolean }): Promise<void>;
  setSubscribed(id: number, subscribed: boolean): Promise<void>;
  listSubscribers(): Promise<Subscriber[]>;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS stop_list (
    branch_id text NOT NULL,
    item_id text NOT NULL,
    updated_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (branch_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    tg_id bigint PRIMARY KEY,
    first_name text,
    last_name text,
    username text,
    language text,
    phone text,
    subscribed boolean NOT NULL DEFAULT true,
    orders_count integer NOT NULL DEFAULT 0,
    last_order_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
];

function postgresStore(url: string): Store {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const init = () => (ready ??= Promise.all(SCHEMA.map((q) => sql.query(q))).catch((err) => {
    ready = null; // retry on the next call
    throw err;
  }));

  return {
    async getStopList() {
      await init();
      const rows = (await sql`SELECT branch_id, item_id FROM stop_list`) as { branch_id: string; item_id: string }[];
      const out: StopList = {};
      for (const r of rows) (out[r.branch_id] ??= []).push(r.item_id);
      return out;
    },
    async setAvailable(branchId, itemId, available, by) {
      await init();
      if (available) await sql`DELETE FROM stop_list WHERE branch_id = ${branchId} AND item_id = ${itemId}`;
      else
        await sql`INSERT INTO stop_list (branch_id, item_id, updated_by) VALUES (${branchId}, ${itemId}, ${by})
          ON CONFLICT (branch_id, item_id) DO UPDATE SET updated_by = EXCLUDED.updated_by, updated_at = now()`;
    },
    async upsertCustomer(u, extra = {}) {
      await init();
      const ordered = extra.ordered ? 1 : 0;
      await sql`INSERT INTO customers (tg_id, first_name, last_name, username, language, phone, orders_count, last_order_at)
        VALUES (${u.id}, ${u.first_name ?? null}, ${u.last_name ?? null}, ${u.username ?? null}, ${u.language_code ?? null},
                ${extra.phone ?? null}, ${ordered}, ${ordered ? new Date() : null})
        ON CONFLICT (tg_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          username = EXCLUDED.username,
          language = COALESCE(EXCLUDED.language, customers.language),
          phone = COALESCE(EXCLUDED.phone, customers.phone),
          orders_count = customers.orders_count + ${ordered},
          last_order_at = COALESCE(EXCLUDED.last_order_at, customers.last_order_at),
          updated_at = now()`;
    },
    async setSubscribed(id, subscribed) {
      await init();
      await sql`UPDATE customers SET subscribed = ${subscribed}, updated_at = now() WHERE tg_id = ${id}`;
    },
    async listSubscribers() {
      await init();
      const rows = (await sql`SELECT tg_id, language FROM customers WHERE subscribed ORDER BY tg_id`) as {
        tg_id: string;
        language: string | null;
      }[];
      return rows.map((r) => ({ id: Number(r.tg_id), language: r.language }));
    },
  };
}

function memoryStore(): Store {
  const stop = new Map<string, Set<string>>();
  const customers = new Map<number, { language: string | null; subscribed: boolean }>();
  return {
    async getStopList() {
      return Object.fromEntries([...stop].map(([b, s]) => [b, [...s]]));
    },
    async setAvailable(branchId, itemId, available) {
      const set = stop.get(branchId) ?? new Set();
      if (available) set.delete(itemId);
      else set.add(itemId);
      stop.set(branchId, set);
    },
    async upsertCustomer(u) {
      const prev = customers.get(u.id);
      customers.set(u.id, { language: u.language_code ?? prev?.language ?? null, subscribed: prev?.subscribed ?? true });
    },
    async setSubscribed(id, subscribed) {
      const prev = customers.get(id);
      if (prev) prev.subscribed = subscribed;
    },
    async listSubscribers() {
      return [...customers].filter(([, c]) => c.subscribed).map(([id, c]) => ({ id, language: c.language }));
    },
  };
}

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const globalStore = globalThis as unknown as { __sushimeiStore?: Store };
// Kept on globalThis so the in-memory store survives dev hot reloads.
export const db: Store = (globalStore.__sushimeiStore ??= url ? postgresStore(url) : memoryStore());
export const hasDatabase = !!url;
