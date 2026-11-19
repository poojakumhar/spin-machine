import { readFile } from "node:fs/promises";
import path from "node:path";

// Serves public/reels at runtime (next start only knows files present at build time).
const TYPES: Record<string, string> = { png: "image/png", webp: "image/webp", svg: "image/svg+xml" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = path.basename((await params).name);
  const type = TYPES[name.split(".").pop() ?? ""];
  if (!type) return new Response("not found", { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "reels", name));
    return new Response(buf, { headers: { "content-type": type, "cache-control": "public, max-age=3600" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
