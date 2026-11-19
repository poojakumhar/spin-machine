import { sql } from "./db";

/** The number of the next spin within the script: spins since the last position reset, plus one. */
export async function nextSpinNumber() {
  const [{ c }] = await sql`SELECT count(*)::int AS c FROM spins`;
  const [o] = await sql`SELECT value FROM settings WHERE key = 'spin_offset'`;
  return Math.max(1, (c as number) - Number(o?.value ?? 0) + 1);
}
