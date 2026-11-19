// End-to-end API checks against a running server (use with LOCAL_DB=1 and dev-fill data). Mutates data.
const base = process.env.BASE ?? "http://localhost:3100";
let cookie = "";
const out = [];
const check = (name, ok, detail = "") => out.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
const call = async (path, method = "GET", body) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const spin = async () => (await call("/api/spin", "POST")).json;
const ids = (s) => s.result.map((x) => x.id);

await call("/api/admin/login", "POST", { username: "admin@gmail.com", password: process.env.ADMIN_PASSWORD ?? "admin@123" });
const items = (await call("/api/admin/items")).json.items;
let script = (await call("/api/admin/script")).json;
const start = script.nextSpin;
check("admin APIs return real data", items.length >= 26 && script.rows.length === 8, `${items.length} items, ${script.rows.length} script rows, next spin ${start}`);

// 1. a fully scripted spin returns exactly the scripted ids
const row = script.rows[start - 1];
const s1 = await spin();
const want = [row.reel1, row.reel2, row.reel3];
check(`spin ${start} follows the script (fixed reels match, Random reels are free)`, ids(s1).every((v, k) => want[k] === null || want[k] === v), `${ids(s1)} vs ${want}`);
check("next spin advanced by one", (await call("/api/admin/script")).json.nextSpin === start + 1);
// 2. a partly scripted row keeps its fixed reels (spin 3 fixes only reel 2)
script = (await call("/api/admin/script")).json;
const r3 = script.rows[2];
let st = script.nextSpin;
const seq = [];
while (st <= 8 && st < 9) { seq.push({ n: st, row: script.rows[st - 1], res: await spin() }); st++; }
const part = seq.find((x) => x.row.position === 3);
if (part) check("partly scripted spin keeps the fixed reel and randomises the rest", ids(part.res)[1] === r3.reel2, `reel 2 = ${ids(part.res)[1]}, expected ${r3.reel2}`);
// 3. disabled row (7) is not applied; history marks scripted vs random
const stats1 = (await call("/api/admin/stats")).json;
const h = Object.fromEntries(stats1.history.map((x) => [x.seq, x.script_position]));
check("disabled row 7 plays as random (no script position recorded)", h[7] === null || h[7] === undefined, `seq7 script_position=${h[7]}`);
check("scripted spins record their script position", h[1] === 1 && h[2] === 2 && h[4] === 4, JSON.stringify([h[1], h[2], h[4]]));
// 4. past the end of the script: random
const after = await spin();
check("past the last script row the spin is random", !!after.result && (await call("/api/admin/stats")).json.history[0].script_position === null);
// 5. reset position -> next spin #1, history kept
const totalBefore = (await call("/api/admin/stats")).json.total;
await call("/api/admin/reset", "POST", { action: "position" });
const afterReset = (await call("/api/admin/script")).json.nextSpin;
check("reset position restarts the script at spin 1", afterReset === 1, `next=${afterReset}`);
check("reset position keeps the history", (await call("/api/admin/stats")).json.total === totalBefore);
const again = await spin();
const r1 = script.rows[0];
check("after reset spin 1 follows script row 1 again", JSON.stringify(ids(again)) === JSON.stringify([r1.reel1, r1.reel2, r1.reel3]));
// 6. weights and the no-repeat rule on random spins: park the script, then spin a lot
await call("/api/admin/script", "PUT", { rows: [] });
const reel = (n) => items.filter((i) => i.reel === n);
const keep = { 1: [reel(1)[0].id, reel(1)[2].id], 2: [reel(2)[0].id], 3: [reel(3)[0].id] }; // 2 x 1 x 1 = 2 possible combinations
for (const it of items) await call(`/api/admin/items/${it.id}`, "PATCH", { active: keep[it.reel].includes(it.id), weight: 1 });
let repeats = 0, prev = null; const seen = new Set();
for (let k = 0; k < 60; k++) { const s = await spin(); const key = ids(s).join("-"); if (key === prev) repeats++; prev = key; seen.add(key); }
check("never the same combination twice in a row (2 combos, 60 spins)", repeats === 0 && seen.size === 2, `repeats=${repeats}, distinct=${seen.size}`);
// single-item reels: 1 x 1 x 1
await call(`/api/admin/items/${keep[1][1]}`, "PATCH", { active: false });
const only = await spin();
const only2 = await spin();
check("a single possible combination still spins and lands", !!only.result && JSON.stringify(ids(only)) === JSON.stringify(ids(only2)) && only.decoys.every((d) => d.length > 0));
// weights: reel 1 gets weights 9:1 (2 items), others fixed
await call(`/api/admin/items/${keep[1][1]}`, "PATCH", { active: true, weight: 1 });
await call(`/api/admin/items/${keep[1][0]}`, "PATCH", { weight: 9 });
let heavy = 0; const N = 400;
for (let k = 0; k < N; k++) { const s = await spin(); if (s.result[0].id === keep[1][0]) heavy++; }
// the no-repeat rule re-rolls identical consecutive pairs, which flattens a 9:1 split to a strict alternation at worst; with 2 combos
// the expectation under the rule is exactly 50/50, so weights are checked on a reel with more combinations below
check("two-combination case obeys no-repeat (alternates)", Math.abs(heavy - N / 2) <= 2, `heavy=${heavy}/${N}`);
// weights on a roomy setup: reactivate reel 3 (several items), weights 8:1:1... check ordering of frequency
for (const it of reel(3)) await call(`/api/admin/items/${it.id}`, "PATCH", { active: true, weight: it.id === reel(3)[0].id ? 8 : 1 });
for (const it of reel(1)) await call(`/api/admin/items/${it.id}`, "PATCH", { active: true });
for (const it of reel(2)) await call(`/api/admin/items/${it.id}`, "PATCH", { active: true });
const counts = {}; const M = 500;
for (let k = 0; k < M; k++) { const s = await spin(); counts[s.result[2].id] = (counts[s.result[2].id] ?? 0) + 1; }
const top = reel(3)[0].id; const others = reel(3).slice(1).map((i) => counts[i.id] ?? 0);
const exp = (8 / (8 + (reel(3).length - 1))) * M;
check("weights shape the odds (weight 8 vs 1)", counts[top] > 3 * Math.max(...others) && Math.abs(counts[top] - exp) < 70, `top=${counts[top]} expected~${exp.toFixed(0)} others max=${Math.max(...others)}`);
// zero weight is never picked
await call(`/api/admin/items/${reel(3)[1].id}`, "PATCH", { weight: 0 });
let zero = 0; for (let k = 0; k < 150; k++) { const s = await spin(); if (s.result[2].id === reel(3)[1].id) zero++; }
check("weight 0 is never picked", zero === 0, `picked ${zero} times in 150`);
// 7. auth + validation
const noAuth = await fetch(base + "/api/admin/script", { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" });
check("script API refuses requests without a session", noAuth.status === 401, String(noAuth.status));
const bad = await call("/api/admin/items", "POST", { reel: 1, label: "   " });
check("empty label is rejected with a clear message", bad.status === 400 && /label/i.test(bad.json.error), bad.json.error);
console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length} pass, ${out.filter((l) => l.startsWith("FAIL")).length} fail`);
