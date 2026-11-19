/** Wraps a route handler so failures come back as JSON the admin can show (not an empty 500). */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api]", msg);
    if (/DATABASE_URL/.test(msg)) {
      return Response.json({ error: "The database is not connected yet (DATABASE_URL is not set).", code: "db_missing" }, { status: 503 });
    }
    if (/relation .* does not exist/.test(msg)) {
      return Response.json({ error: "The database tables are missing. Run npm run db:migrate.", code: "db_schema" }, { status: 503 });
    }
    return Response.json({ error: "Something went wrong on the server.", detail: msg }, { status: 500 });
  }
}
