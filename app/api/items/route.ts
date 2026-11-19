import { sql, assertDb, type Item } from "@/lib/db";
import { guard } from "@/lib/api";
export const dynamic = "force-dynamic";

// Public: active items, used only to preload images.
export const GET = () =>
  guard(async () => {
    assertDb();
    const items = (await sql`SELECT id, reel, label, image_url FROM reel_items WHERE active ORDER BY reel, sort_order, id`) as unknown as Item[];
    return Response.json({ items });
  });
