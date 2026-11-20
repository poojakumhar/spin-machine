// Names required: the server refuses new empty spins, old empty spins are marked red and skipped, switched-off spins are skipped.
// Local server only. Uses the existing script (expects an old empty spin to be present); restores it afterwards.
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.log("refusing: local server only"); process.exit(1); }
const OUT = process.argv[3] ?? "shots";
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE + "/admin");
const inputs = p.locator("form input");
if (await inputs.count() >= 2) { await inputs.nth(0).fill("admin@gmail.com"); await inputs.nth(1).fill("admin@123"); await p.keyboard.press("Enter"); }
await p.waitForSelector(".sc-add", { timeout: 20000 });
const r = p.request; const j = async (x) => x.json();
const strip = (rows) => rows.map(({ reel1, reel2, reel3, enabled, note }) => ({ reel1, reel2, reel3, enabled, note }));
const prev = strip((await j(await r.get(BASE + "/api/admin/script"))).rows);
const items = (await j(await r.get(BASE + "/api/admin/items"))).items;
const full = (x) => x.reel1 !== null && x.reel2 !== null && x.reel3 !== null;
const emptyAt = prev.findIndex((x) => !full(x));
const one = (rl) => items.find((i) => i.reel === rl && i.active).id;

// server refuses a NEW empty spin
const bad = await r.put(BASE + "/api/admin/script", { data: { rows: [...prev, { reel1: one(1), reel2: null, reel3: one(3), enabled: true, note: "" }] } });
ok("server refuses a new spin with an empty name", bad.status() === 400, `${bad.status()} ${(await j(bad)).error}`);
ok("…and nothing changed", JSON.stringify(strip((await j(await r.get(BASE + "/api/admin/script"))).rows)) === JSON.stringify(prev));

if (emptyAt < 0) { console.log("SKIP  no old empty spin in this database"); }
else {
  // old empty spin is marked and can still be moved
  await p.reload(); await p.waitForSelector(".sc-row .sc-cell");
  const row = p.locator(".sc-row").nth(emptyAt);
  ok("old empty spin is marked red", (await row.getAttribute("class")).includes("missing") && /Names missing/.test(await row.innerText()));
  await p.screenshot({ path: `${OUT}/admin-missing-names.png`, clip: { x: 0, y: 0, width: 1440, height: 640 } });
  const moved = [...prev]; const to = emptyAt > 0 ? emptyAt - 1 : emptyAt + 1; [moved[emptyAt], moved[to]] = [moved[to], moved[emptyAt]];
  const mv = await r.put(BASE + "/api/admin/script", { data: { rows: moved } });
  ok("old empty spin can still be moved (other saves still work)", mv.ok(), String(mv.status()));
  await r.put(BASE + "/api/admin/script", { data: { rows: prev } });
}

// pulls skip empty and switched-off spins
const playable = prev.map((x, k) => (x.enabled && full(x) ? k + 1 : null)).filter(Boolean);
await r.post(BASE + "/api/admin/reset", { data: { action: "position" } });
const seen = [];
for (let k = 0; k < Math.max(3, playable.length + 1); k++) {
  seen.push((await j(await r.get(BASE + "/api/admin/script"))).nextSpin);
  await r.post(BASE + "/api/spin");
}
const expect = seen.map((_, k) => playable.length ? playable[k % playable.length] : null);
ok("pulls play only switched-on spins with all names", playable.length === 0 || JSON.stringify(seen) === JSON.stringify(expect), `played ${seen.join(", ")}; playable ${playable.join(", ")}`);
await r.post(BASE + "/api/admin/reset", { data: { action: "position" } });
await b.close();
