import { sql, assertDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";

export const POST = (req: Request) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    const { ids } = (await req.json()) as { ids: number[] };
    if (!Array.isArray(ids)) return Response.json({ error: "ids required" }, { status: 400 });
    await sql.transaction(ids.map((id, i) => sql`UPDATE reel_items SET sort_order=${i} WHERE id=${Number(id)}`));
    return Response.json({ ok: true });
  });
