import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const RAW_CONN = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!RAW_CONN || !/^postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+\/.+/.test(RAW_CONN)) {
  const msg = !RAW_CONN
    ? "[storage] DATABASE_URL is not set. Set it in Vercel → Project → Settings → Environment Variables to the Neon connection string (postgresql://user:password@host/dbname?sslmode=require)."
    : "[storage] DATABASE_URL is malformed. Expected postgresql://user:password@host/dbname?sslmode=require. Check for empty strings, extra quotes, or missing credentials in the Vercel env var.";
  console.error(msg);
}
// The @neondatabase/serverless HTTP driver needs the non-pooled endpoint.
// The "-pooler" host is for TCP/PgBouncer connections and can cause
// intermittent fetch failures when used with the HTTP driver.
// Prefer POSTGRES_URL_NON_POOLING (set by Vercel Neon integration).
// Otherwise strip "-pooler" from the hostname and remove TCP-only params.
const CONN = RAW_CONN
  ? RAW_CONN
      .replace(/-pooler\./, ".")
      .replace(/[?&]channel_binding=[^&]*/g, "")
      .replace(/[?&]sslmode=[^&]*/g, "")
      .replace(/\?$/, "")
  : "postgresql://user:pass@localhost/placeholder";
export const sql = neon(CONN);
export const db = drizzle(sql);
