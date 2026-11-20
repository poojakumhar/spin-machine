import { sql } from "./db";

/**
 * The spin (script position) the next pull plays. Only spins that are switched on and have all three names
 * are played; the others are skipped. Counts pulls since the last reset and starts again at the first playable
 * spin after the last one. With no playable spin it returns the pull number, which matches no spin (random).
 */
export async function nextSpinNumber() {
  const [{ c }] = await sql`SELECT count(*)::int AS c FROM spins`;
  const [o] = await sql`SELECT value FROM settings WHERE key = 'spin_offset'`;
  const playable = await sql`SELECT position FROM spin_script
    WHERE enabled AND reel1_item_id IS NOT NULL AND reel2_item_id IS NOT NULL AND reel3_item_id IS NOT NULL ORDER BY position`;
  const n = Math.max(1, (c as number) - Number(o?.value ?? 0) + 1);
  return playable.length ? Number(playable[(n - 1) % playable.length].position) : n;
}
