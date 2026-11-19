import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";
import { sql } from "@/lib/db";

const EXT: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };
const MAX = 4_000_000;   // Vercel accepts request bodies up to 4.5 MB

// Stores the image in the database (Vercel cannot write files at runtime); /api/img/<name> serves it.
export const POST = (req: Request) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    const f = (await req.formData()).get("file");
    if (!(f instanceof File) || !EXT[f.type]) return Response.json({ error: "Use a PNG, WebP or SVG image." }, { status: 400 });
    if (f.size > MAX) return Response.json({ error: "The image is over 4 MB." }, { status: 400 });
    const base = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "image";
    const name = `${base}-${Date.now().toString(36)}.${EXT[f.type]}`;
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    await sql`INSERT INTO images (name, type, data) VALUES (${name}, ${f.type}, decode(${b64}, 'base64'))`;
    return Response.json({ image_url: `/api/img/${name}` });
  });
