import { sql, assertDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";
import { nextSpinNumber } from "@/lib/spinState";
export const dynamic = "force-dynamic";

export const GET = () =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    const rows = await sql`SELECT position, reel1_item_id AS reel1, reel2_item_id AS reel2, reel3_item_id AS reel3, enabled, note
      FROM spin_script ORDER BY position`;
    return Response.json({ rows, nextSpin: await nextSpinNumber() });
  });

type In = { reel1: number | null; reel2: number | null; reel3: number | null; enabled: boolean; note: string };
const id = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

// Replaces the whole script: row N of the list becomes spin N.
export const PUT = (req: Request) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    const { rows } = (await req.json()) as { rows: In[] };
    if (!Array.isArray(rows) || rows.length > 500) return Response.json({ error: "The script can hold up to 500 spins." }, { status: 400 });
    const clean = rows.map((r) => ({ a: id(r.reel1), b: id(r.reel2), c: id(r.reel3), enabled: r.enabled !== false, note: String(r.note ?? "").slice(0, 120) }));
    if (clean.some((r) => [r.a, r.b, r.c].some((v) => v !== null && !Number.isInteger(v)))) {
      return Response.json({ error: "A reel has an invalid item." }, { status: 400 });
    }
    // Every spin needs a name on all three reels. Old spins saved empty before this rule are let through
    // unchanged (so moving, switching or deleting others still works); any new or edited empty spin is refused.
    const key = (r: { a: number | null; b: number | null; c: number | null }) => `${r.a}|${r.b}|${r.c}`;
    const old = await sql`SELECT reel1_item_id a, reel2_item_id b, reel3_item_id c FROM spin_script
      WHERE reel1_item_id IS NULL OR reel2_item_id IS NULL OR reel3_item_id IS NULL`;
    const left = new Map<string, number>();
    for (const r of old) left.set(key(r as never), (left.get(key(r as never)) ?? 0) + 1);
    for (const r of clean) {
      if (r.a !== null && r.b !== null && r.c !== null) continue;
      const k = key(r);
      if (!left.get(k)) return Response.json({ error: "Every spin needs a name on all three reels." }, { status: 400 });
      left.set(k, left.get(k)! - 1);
    }
    await sql.transaction([
      sql`DELETE FROM spin_script`,
      ...clean.map((r, i) => sql`INSERT INTO spin_script (position,reel1_item_id,reel2_item_id,reel3_item_id,enabled,note)
        VALUES (${i + 1},${r.a},${r.b},${r.c},${r.enabled},${r.note})`),
    ]);
    return Response.json({ ok: true, saved: clean.length });
  });
