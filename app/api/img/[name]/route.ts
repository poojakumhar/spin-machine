import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "@/lib/db";

// Serves admin-uploaded images: from the database, or (older uploads) from public/reels.
const TYPES: Record<string, string> = { png: "image/png", webp: "image/webp", svg: "image/svg+xml" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = path.basename((await params).name);
  const type = TYPES[name.split(".").pop() ?? ""];
  if (!type) return new Response("not found", { status: 404 });
  const headers = { "content-type": type, "cache-control": "public, max-age=31536000, immutable" };   // names are unique per upload
  try {
    const [row] = await sql`SELECT encode(data, 'base64') AS b64 FROM images WHERE name = ${name}`;
    if (row) return new Response(Buffer.from(row.b64 as string, "base64"), { headers });
  } catch { /* table missing: fall through to the file */ }
  try {
    return new Response(await readFile(path.join(process.cwd(), "public", "reels", name)), { headers });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
