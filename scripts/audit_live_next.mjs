// The admin's "Next spin" badge follows the kiosk on its own (no reload). Local server only; restarts the sequence after.
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.log("refusing: local server only"); process.exit(1); }
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE + "/admin");
const inputs = p.locator("form input");
if (await inputs.count() >= 2) { await inputs.nth(0).fill("admin@gmail.com"); await inputs.nth(1).fill("admin@123"); await p.keyboard.press("Enter"); }
await p.waitForSelector("[data-testid=next-chip]", { timeout: 20000 });
const r = p.request; const j = async (x) => x.json();
await r.post(BASE + "/api/admin/reset", { data: { action: "position" } });
await p.reload(); await p.waitForSelector("[data-testid=next-chip]"); await p.waitForTimeout(800);
const chip = async () => (await p.locator("[data-testid=next-chip]").innerText()).replace(/\s+/g, " ");
const len = (await j(await r.get(BASE + "/api/admin/script"))).rows.length;
ok("starts at spin 1", /Spin #1\b/.test(await chip()), await chip());
for (let k = 2; k <= Math.min(3, len); k++) {
  await r.post(BASE + "/api/spin");                 // a pull on the kiosk
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && !new RegExp(`Spin #${k}\\b`).test(await chip())) await p.waitForTimeout(250);
  ok(`after a kiosk pull the badge shows spin ${k} by itself`, new RegExp(`Spin #${k}\\b`).test(await chip()), `${await chip()} after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const rowNext = await p.locator(".sc-row.next .sc-num strong").innerText().catch(() => "");
ok("highlighted row matches the badge", (await chip()).includes(rowNext.replace("Spin ", "Spin #")), rowNext);
await r.post(BASE + "/api/admin/reset", { data: { action: "position" } });
await b.close();
