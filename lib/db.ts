import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export type Sql = {
  (s: TemplateStringsArray, ...v: unknown[]): Promise<Row[]>;
  transaction(qs: Promise<Row[]>[]): Promise<Row[][]>;
};

export const dbConfigured = () => process.env.LOCAL_DB === "1" || !!process.env.DATABASE_URL;
export function assertDb() {
  if (!dbConfigured()) throw new Error("DATABASE_URL is not set (run `neon deploy` / `neon env pull`)");
}

/** Local PGlite database for testing without Neon (LOCAL_DB=1). Same SQL, real Postgres engine. */
function makeLocal(): Sql {
  type Lite = {
    query(t: string, p?: unknown[]): Promise<{ rows: Row[] }>;
    exec(t: string): Promise<unknown>;
    transaction<T>(f: (tx: Lite) => Promise<T>): Promise<T>;
  };
  let dbp: Promise<Lite> | null = null;
  const get = () =>
    (dbp ??= (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const db = new PGlite(process.env.LOCAL_DB_DIR ?? ".localdb") as unknown as Lite;
      await db.exec(readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8"));
      return db;
    })());
  const mk = (s: TemplateStringsArray, v: unknown[]) => {
    const text = s.reduce((a, part, i) => a + part + (i < v.length ? `$${i + 1}` : ""), "");
    const q = {
      text,
      values: v,
      then: (a: (r: Row[]) => unknown, b?: (e: unknown) => unknown) => get().then((d) => d.query(text, v)).then((r) => r.rows).then(a, b),
    };
    return q as unknown as Promise<Row[]>;
  };
  const sql = ((s: TemplateStringsArray, ...v: unknown[]) => mk(s, v)) as Sql;
  sql.transaction = async (qs) => {
    const d = await get();
    const items = qs as unknown as { text: string; values: unknown[] }[];
    return d.transaction(async (tx) => {
      const out: Row[][] = [];
      for (const q of items) out.push((await tx.query(q.text, q.values)).rows);
      return out;
    });
  };
  return sql;
}

export const sql: Sql =
  process.env.LOCAL_DB === "1" ? makeLocal() : (neon(process.env.DATABASE_URL ?? "postgres://missing") as unknown as Sql);

export type Item = {
  id: number; reel: 1 | 2 | 3; label: string; image_url: string | null;
  weight: number; active: boolean; sort_order: number;
};
