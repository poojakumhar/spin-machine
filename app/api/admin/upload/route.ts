import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { isAdmin, unauthorized } from "@/lib/auth";
import { guard } from "@/lib/api";

const EXT: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

export const POST = (req: Request) =>
  guard(async () => {
    if (!(await isAdmin())) return unauthorized();
    const f = (await req.formData()).get("file");
    if (!(f instanceof File) || !EXT[f.type]) return Response.json({ error: "Use a PNG, WebP or SVG image." }, { status: 400 });
    if (f.size > 5_000_000) return Response.json({ error: "The image is over 5 MB." }, { status: 400 });
    const base = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "image";
    const name = `${base}-${Date.now().toString(36)}.${EXT[f.type]}`;
    const dir = path.join(process.cwd(), "public", "reels");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
    return Response.json({ image_url: `/api/img/${name}` });
  });
