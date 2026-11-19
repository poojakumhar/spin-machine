import { sql, assertDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: Request, { params }: Ctx) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    const id = Number((await params).id), b = await req.json();
    if (typeof b.label === "string" && !b.label.trim()) return Response.json({ error: "The label cannot be empty." }, { status: 400 });
    const hasImg = "image_url" in b;
    const weight = b.weight == null ? null : Math.max(0, Number(b.weight) | 0);
    const label = typeof b.label === "string" ? b.label.trim() : null;
    const [row] = await sql`UPDATE reel_items SET
      label = COALESCE(${label}, label),
      image_url = CASE WHEN ${hasImg}::boolean THEN ${b.image_url || null} ELSE image_url END,
      weight = COALESCE(${weight}::int, weight),
      active = COALESCE(${b.active ?? null}::boolean, active)
      WHERE id=${id} RETURNING *`;
    return row ? Response.json({ item: row }) : Response.json({ error: "That item no longer exists." }, { status: 404 });
  });

export const DELETE = (_: Request, { params }: Ctx) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    await sql`DELETE FROM reel_items WHERE id=${Number((await params).id)}`;
    return Response.json({ ok: true });
  });
