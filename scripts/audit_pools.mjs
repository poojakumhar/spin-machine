// Each wheel spins through only the names in its spin-script column. Local server only; restores the script after.
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.log("refusing: local server only"); process.exit(1); }
const OUT = process.argv[3] ?? "shots";
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE + "/admin");
const inputs = p.locator("form input");
if (await inputs.count() >= 2) { await inputs.nth(0).fill("admin@gmail.com"); await inputs.nth(1).fill("admin@123"); await p.keyboard.press("Enter"); }
await p.waitForSelector(".sc-row, .empty", { timeout: 20000 });
const r = p.request; const j = async (x) => x.json();

ok("Spin script opens first", /Spin script/.test(await p.locator("h1").first().innerText()));
ok("no Reels tab", (await p.locator(".adm-link", { hasText: /^Reels$/ }).count()) === 0, (await p.locator(".adm-link").allInnerTexts()).join(" | "));
ok("no copy buttons", (await p.locator('[aria-label^="Duplicate"]').count()) === 0);

const items = (await j(await r.get(BASE + "/api/admin/items"))).items.filter((i) => i.active);
const reel = (n) => items.filter((i) => i.reel === n).sort((a, c) => a.sort_order - c.sort_order);
const prev = (await j(await r.get(BASE + "/api/admin/script"))).rows;
// 5 spins: wheel 1 gets 5 different words; wheel 2 three animals; wheel 3 two words.
// The existing spins are kept but switched off in front (switched-off spins are skipped and add no names), so they can be restored.
const plan = [0, 1, 2, 3, 4].map((k) => ({ reel1: reel(1)[k].id, reel2: reel(2)[k % 3].id, reel3: reel(3)[k % 2].id, enabled: true, note: "" }));
const keep = prev.map(({ reel1, reel2, reel3, note }) => ({ reel1, reel2, reel3, enabled: false, note }));
await r.put(BASE + "/api/admin/script", { data: { rows: [...keep, ...plan] } });
await r.post(BASE + "/api/admin/reset", { data: { action: "position" } });
const w1 = plan.map((x) => reel(1).find((i) => i.id === x.reel1).label);
const w3 = [...new Set(plan.map((x) => reel(3).find((i) => i.id === x.reel3).label))];

const shown = (await j(await r.get(BASE + "/api/items"))).items;
const names = (n) => shown.filter((i) => i.reel === n).map((i) => i.label);
ok("kiosk wheel 1 = the 5 script words", JSON.stringify(names(1)) === JSON.stringify(w1), names(1).join(", "));
ok("kiosk wheel 3 = its 2 script words", JSON.stringify(names(3)) === JSON.stringify(w3), names(3).join(", "));
const w2 = [...new Set(plan.map((x) => reel(2).find((i) => i.id === x.reel2).label))];
ok("kiosk wheel 2 = its 3 script animals", JSON.stringify(names(2)) === JSON.stringify(w2), names(2).join(", "));

let stray = 0;
for (let k = 0; k < 6; k++) {
  const s = await j(await r.post(BASE + "/api/spin"));
  const rolled1 = [s.result[0], ...s.decoys[0]].map((c) => c.label);
  const rolled2 = [s.result[1], ...s.decoys[1]].map((c) => c.label);
  const rolled3 = [s.result[2], ...s.decoys[2]].map((c) => c.label);
  stray += rolled1.filter((l) => !w1.includes(l)).length + rolled2.filter((l) => !w2.includes(l)).length + rolled3.filter((l) => !w3.includes(l)).length;
  if (k < 5) ok(`pull ${k + 1}: wheel 1 lands on spin ${k + 1}'s word`, s.result[0].label === w1[k], s.result[0].label);
}
ok("no wheel rolls past a name outside its column", stray === 0, `${stray} stray`);

await p.reload(); await p.waitForSelector(".sc-row"); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/admin-script-only.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
await r.put(BASE + "/api/admin/script", { data: { rows: prev.map(({ reel1, reel2, reel3, enabled, note }) => ({ reel1, reel2, reel3, enabled, note })) } });
await r.post(BASE + "/api/admin/reset", { data: { action: "position" } });
await b.close();
