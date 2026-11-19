import { sql, assertDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";
import { nextSpinNumber } from "@/lib/spinState";
export const dynamic = "force-dynamic";

export const GET = () =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    const [{ total, scripted }] = await sql`SELECT count(*)::int AS total, count(script_position)::int AS scripted FROM spins`;
    const perItem = await sql`
      SELECT r.id, r.reel, r.label, count(s.id)::int AS count FROM reel_items r
      LEFT JOIN spins s ON (r.reel=1 AND s.reel1_item_id=r.id) OR (r.reel=2 AND s.reel2_item_id=r.id) OR (r.reel=3 AND s.reel3_item_id=r.id)
      GROUP BY r.id ORDER BY r.reel, r.sort_order, r.id`;
    const combos = await sql`
      SELECT reel1_label a, reel2_label b, reel3_label c, count(*)::int AS count FROM spins
      GROUP BY 1,2,3 ORDER BY count DESC, a LIMIT 10`;
    const history = await sql`
      SELECT * FROM (
        SELECT id, created_at, reel1_label a, reel2_label b, reel3_label c, script_position,
               row_number() OVER (ORDER BY id)::int AS seq
        FROM spins) t ORDER BY id DESC LIMIT 50`;
    return Response.json({ total, scripted, nextSpin: await nextSpinNumber(), perItem, combos, history });
  });
