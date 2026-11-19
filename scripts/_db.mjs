// Shared by the setup scripts: talks to Neon (DATABASE_URL) or, with LOCAL_DB=1, to a local PGlite database.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

export async function connect() {
  if (process.env.LOCAL_DB === "1") {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(process.env.LOCAL_DB_DIR ?? ".localdb");
    return { label: "local PGlite", query: async (t, p = []) => (await db.query(t, p)).rows, exec: (t) => db.exec(t), close: () => db.close() };
  }
  // schema changes go over the direct (unpooled) connection; app traffic uses the pooled DATABASE_URL
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (run `neon deploy` / `neon env pull`, or use LOCAL_DB=1)");
  const sql = neon(url);
  return {
    label: "Neon",
    close: async () => {},
    query: (t, p = []) => sql.query(t, p),
    exec: async (t) => {
      for (const s of t.split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await sql.query(s);
    },
  };
}
export const schemaSql = () => readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
