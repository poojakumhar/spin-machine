import { sql, assertDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";

export const POST = (req: Request) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    assertDb();
    const { action } = (await req.json()) as { action: string };
    if (action === "position") {
      // The script starts again at spin 1; history and the script itself are kept.
      const [{ c }] = await sql`SELECT count(*)::int AS c FROM spins`;
      await sql`INSERT INTO settings (key, value) VALUES ('spin_offset', ${String(c)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      return Response.json({ ok: true });
    }
    if (action === "history") {
      // Deletes the spin history only. Items and the script are kept, and the script restarts at spin 1.
      await sql.transaction([
        sql`DELETE FROM spins`,
        sql`INSERT INTO settings (key, value) VALUES ('spin_offset', '0') ON CONFLICT (key) DO UPDATE SET value = '0'`,
      ]);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  });
