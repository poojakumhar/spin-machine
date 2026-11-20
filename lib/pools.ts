import { sql, type Item } from "./db";

/**
 * The names each wheel spins through. Wheel N uses the items picked in column N of the spin script
 * (switched-on spins only, in script order, each name once). A wheel whose column is empty or all Random
 * falls back to every switched-on item for that reel.
 */
export async function reelPools(): Promise<Item[][]> {
  const all = (await sql`SELECT * FROM reel_items WHERE active ORDER BY sort_order, id`) as unknown as Item[];
  const rows = await sql`SELECT reel1_item_id a, reel2_item_id b, reel3_item_id c FROM spin_script WHERE enabled ORDER BY position`;
  return [1, 2, 3].map((r, k) => {
    const ids = [...new Set(rows.map((row) => [row.a, row.b, row.c][k]).filter((id) => id != null).map(Number))];
    const pool = ids.map((id) => all.find((i) => i.id === id && i.reel === r)).filter((i): i is Item => !!i);
    return pool.length ? pool : all.filter((i) => i.reel === r);
  });
}
