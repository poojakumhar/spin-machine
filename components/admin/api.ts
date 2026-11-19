export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check the connection and try again.", 0, "network");
  }
  const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!r.ok) throw new ApiError(j.error ?? `The server answered with an error (${r.status}).`, r.status, j.code);
  return j as T;
}

export const MAX_IMAGE_BYTES = 4_000_000;
const TYPES = ["image/png", "image/webp", "image/svg+xml"];

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1_048_576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1_048_576).toFixed(1)} MB`);

/** Returns a message for the first problem, or null. */
export function imageProblem(f: File): string | null {
  if (!TYPES.includes(f.type)) return `${f.name} is not a PNG, WebP or SVG image.`;
  if (f.size > MAX_IMAGE_BYTES) return `${f.name} is ${formatBytes(f.size)}. The limit is 4 MB.`;
  return null;
}

export async function uploadImage(f: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", f);
  let r: Response;
  try {
    r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  } catch {
    throw new ApiError("Cannot reach the server. The image was not uploaded.", 0, "network");
  }
  const j = (await r.json().catch(() => ({}))) as { error?: string; image_url?: string };
  if (!r.ok || !j.image_url) throw new ApiError(j.error ?? "The image could not be uploaded.", r.status);
  return j.image_url;
}
