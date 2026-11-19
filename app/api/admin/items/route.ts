import { sql, assertDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";
export const dynamic = "force-dynamic";

export const GET = () =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    return Response.json({ items: await sql`SELECT * FROM reel_items ORDER BY reel, sort_order, id` });
  });

export const POST = (req: Request) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    const b = await req.json();
    const reel = Number(b.reel), label = String(b.label ?? "").trim();
    if (![1, 2, 3].includes(reel)) return Response.json({ error: "Pick a reel." }, { status: 400 });
    if (!label) return Response.json({ error: "Enter a label." }, { status: 400 });
    if (label.length > 60) return Response.json({ error: "Keep the label under 60 characters." }, { status: 400 });
    const [row] = await sql`INSERT INTO reel_items (reel,label,image_url,weight,active,sort_order)
      VALUES (${reel},${label},${b.image_url || null},${Math.max(0, Number(b.weight ?? 1) | 0)},true,
      (SELECT COALESCE(MAX(sort_order),-1)+1 FROM reel_items WHERE reel=${reel})) RETURNING *`;
    return Response.json({ item: row });
  });
