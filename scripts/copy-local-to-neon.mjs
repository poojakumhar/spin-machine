// One-time copy of the local PGlite database (.localdb) into Neon: reel items, spin script, settings and spin history.
// Keeps the ids so the script and stats still point at the right items. Refuses to run if Neon already has reel items.
// Stop the local server first (PGlite allows one process at a time).
//   node --env-file=.env.local scripts/copy-local-to-neon.mjs
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const neonSql = neon(url);
const local = new PGlite(process.env.LOCAL_DB_DIR ?? ".localdb");

const [{ n }] = await neonSql.query("SELECT count(*)::int AS n FROM reel_items");
if (n > 0) { console.log(`copy: skipped, Neon already has ${n} reel items`); process.exit(0); }

const TABLES = [
  ["reel_items", "id"],
  ["spin_script", null],
  ["settings", null],
  ["spins", "id"],
];
const queries = [];
const counts = {};
for (const [table, serial] of TABLES) {
  const rows = (await local.query(`SELECT * FROM ${table}`)).rows;
  counts[table] = rows.length;
  for (const r of rows) {
    const cols = Object.keys(r);
    queries.push(neonSql.query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      cols.map((c) => r[c]),
    ));
  }
  if (serial && rows.length) {
    queries.push(neonSql.query(`SELECT setval(pg_get_serial_sequence('${table}','${serial}'), (SELECT max(${serial}) FROM ${table}))`));
  }
}
await neonSql.transaction(queries);   // all or nothing
await local.close();
console.log("copy: ok", counts);
