import { assertDb } from "@/lib/db";
import { reelPools } from "@/lib/pools";
import { guard } from "@/lib/api";
export const dynamic = "force-dynamic";

// Public: the names each wheel spins through (see reelPools), used to preload images and show the idle reels.
export const GET = () =>
  guard(async () => {
    assertDb();
    const items = (await reelPools()).flat().map(({ id, reel, label, image_url }) => ({ id, reel, label, image_url }));
    return Response.json({ items });
  });
