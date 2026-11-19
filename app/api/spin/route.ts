import { sql, assertDb, type Item } from "@/lib/db";
import { guard } from "@/lib/api";
import { nextSpinNumber } from "@/lib/spinState";
export const dynamic = "force-dynamic";

const pub = (i: Item) => ({ id: i.id, label: i.label, image_url: i.image_url });

function weighted(items: Item[]): Item {
  const pool = items.filter((i) => i.weight > 0);
  const list = pool.length ? pool : items; // all weights 0 -> uniform
  const w = (i: Item) => (pool.length ? i.weight : 1);
  let r = Math.random() * list.reduce((s, i) => s + w(i), 0);
  for (const i of list) { r -= w(i); if (r < 0) return i; }
  return list[list.length - 1];
}
function decoys(items: Item[], chosen: Item, n = 8) {
  const others = items.filter((i) => i.id !== chosen.id);
  const src = others.length ? others : [chosen]; // single-item reel: spin through repeats
  const start = Math.floor(Math.random() * src.length);
  return Array.from({ length: n }, (_, k) => pub(src[(start + k) % src.length]));
}

export const POST = () =>
  guard(async () => {
    assertDb();
    const all = (await sql`SELECT * FROM reel_items WHERE active ORDER BY sort_order, id`) as unknown as Item[];
    const byReel = [1, 2, 3].map((r) => all.filter((i) => i.reel === r));
    if (byReel.some((l) => l.length === 0)) {
      return Response.json({ error: "Every reel needs at least one active item" }, { status: 409 });
    }
    // Spin script: row N decides the Nth spin since the last reset. A NULL reel (or an item that is no longer active) stays random.
    const n = await nextSpinNumber();
    const [scripted] = await sql`SELECT reel1_item_id a, reel2_item_id b, reel3_item_id c FROM spin_script WHERE position = ${n} AND enabled`;
    const fixed: (Item | null)[] = [scripted?.a, scripted?.b, scripted?.c].map((id, k) => byReel[k].find((i) => i.id === id) ?? null);
    const allFixed = fixed.every(Boolean);

    const [last] = await sql`SELECT reel1_item_id a, reel2_item_id b, reel3_item_id c FROM spins ORDER BY id DESC LIMIT 1`;
    const combos = byReel.reduce((p, l, k) => p * (fixed[k] ? 1 : l.length), 1);
    let pick: Item[] = [];
    for (let t = 0; t < 25; t++) {
      pick = byReel.map((l, k) => fixed[k] ?? weighted(l));
      const same = last && pick[0].id === last.a && pick[1].id === last.b && pick[2].id === last.c;
      if (!same || allFixed || combos === 1) break; // a scripted result is exactly what was asked for
    }
    // Re-rolling can keep drawing the heavy item. If it still matches the last spin, force a different item on one free reel.
    const stillSame = last && pick[0].id === last.a && pick[1].id === last.b && pick[2].id === last.c;
    if (stillSame && !allFixed && combos > 1) {
      const k = [0, 1, 2].find((x) => !fixed[x] && byReel[x].length > 1);
      if (k !== undefined) pick[k] = weighted(byReel[k].filter((i) => i.id !== pick[k].id));
    }
    const [row] = await sql`INSERT INTO spins (reel1_item_id,reel2_item_id,reel3_item_id,reel1_label,reel2_label,reel3_label,script_position)
      VALUES (${pick[0].id},${pick[1].id},${pick[2].id},${pick[0].label},${pick[1].label},${pick[2].label},${scripted ? n : null}) RETURNING id`;
    return Response.json({
      spinId: row.id,
      result: pick.map(pub),
      decoys: pick.map((p, k) => decoys(byReel[k], p)),
    });
  });
