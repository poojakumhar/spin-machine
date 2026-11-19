import { credentialsOk, setSession, clearSession, lockedFor, recordFailure, clearFailures } from "@/lib/auth";

export async function POST(req: Request) {
  const key = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const wait = lockedFor(key);
  if (wait) return Response.json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` }, { status: 429 });
  const { username, password } = await req.json().catch(() => ({ username: "", password: "" }));
  if (!credentialsOk(String(username ?? "").trim(), String(password ?? ""))) {
    recordFailure(key);
    return Response.json({ error: "Wrong ID or password" }, { status: 401 });
  }
  clearFailures(key);
  await setSession();
  return Response.json({ ok: true });
}
export async function DELETE() {
  await clearSession();
  return Response.json({ ok: true });
}
