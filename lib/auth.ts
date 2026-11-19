import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const NAME = "admin_session";
const user = () => process.env.ADMIN_USERNAME ?? "";
const pass = () => process.env.ADMIN_PASSWORD ?? "";
export const authConfigured = () => user().length > 0 && pass().length > 0;

const token = () => createHmac("sha256", `${user()}\n${pass()}`).update("slot-admin-v2").digest("hex");

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function credentialsOk(u: string, p: string) {
  // evaluate both so timing doesn't reveal which one was wrong
  const a = same(u, user()), b = same(p, pass());
  return authConfigured() && a && b;
}

// Sign-in attempts per client: 5 failures locks that client out for 10 minutes (in memory, resets on restart).
const fails = new Map<string, { n: number; until: number }>();
export function lockedFor(key: string) {
  const f = fails.get(key);
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0;
}
export function recordFailure(key: string) {
  const f = fails.get(key);
  const n = (f && f.until > Date.now() - 10 * 60_000 ? f.n : 0) + 1;
  fails.set(key, { n, until: n >= 5 ? Date.now() + 10 * 60_000 : 0 });
}
export const clearFailures = (key: string) => void fails.delete(key);

export async function setSession() {
  (await cookies()).set(NAME, token(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
}
export async function clearSession() { (await cookies()).delete(NAME); }
export async function isAdmin() {
  if (!authConfigured()) return false;
  return same((await cookies()).get(NAME)?.value ?? "", token());
}
export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
