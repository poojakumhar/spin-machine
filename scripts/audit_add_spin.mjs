// Spin script screen: Add/Edit popup with a name box + image upload for each of the 3 reels; changes save straight away; ↑ ↓ reorder.
// Local server only; removes what it created and restores the script.
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
const prev = (await j(await r.get(BASE + "/api/admin/script"))).rows;
const before = (await j(await r.get(BASE + "/api/admin/items"))).items;
const getRows = async () => (await j(await r.get(BASE + "/api/admin/script"))).rows;
const getItems = async () => (await j(await r.get(BASE + "/api/admin/items"))).items;
const nm = (items, id) => items.find((i) => i.id === id)?.label ?? "Random";
const img = (items, id) => items.find((i) => i.id === id)?.image_url ?? "";
const dlg = p.locator("dialog.cf-spin");

ok("no save bar", (await p.locator(".savebar").count()) === 0);

// Add with an image on every reel
await p.locator(".sc-add").click();
ok("popup: 3 name boxes, each with an Upload image button", (await dlg.locator(".as-line").count()) === 3 && (await dlg.getByRole("button", { name: /Upload image$/ }).count()) === 3);
await dlg.locator("#sp-1").fill("Test word"); await dlg.locator("#sp-2").fill("Test animal");
await dlg.getByRole("button", { name: /Add spin/ }).click(); await p.waitForTimeout(500);
ok("empty reel 3 blocks Add", (await dlg.isVisible()) && (await getRows()).length === prev.length && await dlg.locator("#sp-3-err").isVisible());
await p.screenshot({ path: `${OUT}/admin-addspin-missing.png` });
await dlg.locator("#sp-3").fill("Test three");
const files = dlg.locator('input[type=file]');
for (let k = 0; k < 3; k++) await files.nth(k).setInputFiles("public/reels/dog.png");
await p.waitForTimeout(300);
ok("all three show the chosen image", (await dlg.locator(".thumb-btn.changed").count()) === 3);
await p.screenshot({ path: `${OUT}/admin-addspin-filled.png` });
await dlg.getByRole("button", { name: /Add spin/ }).click(); await p.waitForTimeout(2500);
let rows = await getRows(); let items = await getItems(); let last = rows[rows.length - 1];
ok("spin added with all names", rows.length === prev.length + 1 && nm(items, last.reel1) === "Test word" && nm(items, last.reel2) === "Test animal" && nm(items, last.reel3) === "Test three");
ok("all three reels saved an image", [last.reel1, last.reel2, last.reel3].every((id) => /^\/api\/img\//.test(img(items, id))));
await p.screenshot({ path: `${OUT}/admin-spins-list.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

// Edit opens the popup, filled in
await p.locator(".sc-row").last().getByRole("button", { name: "Edit" }).click();
ok("Edit opens the popup", await dlg.isVisible() && /Edit spin/.test(await dlg.locator("h2").innerText()));
ok("popup shows the current names", (await dlg.locator("#sp-1").inputValue()) === "Test word" && (await dlg.locator("#sp-3").inputValue()) === "Test three");
ok("popup shows the saved images", (await dlg.getByRole("button", { name: /Change image$/ }).count()) === 3);
await p.screenshot({ path: `${OUT}/admin-editspin.png` });
await dlg.locator("#sp-1").fill("Test word 2"); await dlg.locator("#sp-3").fill("");
await dlg.getByRole("button", { name: /^Save$/ }).click(); await p.waitForTimeout(600);
ok("Edit with an empty name is not saved", (await dlg.isVisible()) && nm(await getItems(), (await getRows())[rows.length - 1].reel3) === "Test three");
await dlg.locator("#sp-3").fill("Test three");
await dlg.getByRole("button", { name: /^Save$/ }).click(); await p.waitForTimeout(1500);
rows = await getRows(); items = await getItems(); last = rows[rows.length - 1];
ok("Edit → Save stores it", !(await dlg.isVisible()) && nm(items, last.reel1) === "Test word 2" && nm(items, last.reel3) === "Test three", `${nm(items, last.reel1)} · ${nm(items, last.reel2)} · ${nm(items, last.reel3)}`);
await p.locator(".sc-row").last().getByRole("button", { name: "Edit" }).click();
await dlg.locator("#sp-1").fill("Should not save"); await dlg.getByRole("button", { name: "Cancel" }).click(); await p.waitForTimeout(500);
ok("Cancel keeps the saved names", nm(await getItems(), (await getRows())[rows.length - 1].reel1) === "Test word 2");

// Arrows
const n = rows.length;
const was = [rows[n - 2], rows[n - 1]].map((x) => nm(items, x.reel1));
await p.locator(".sc-row").last().getByRole("button", { name: `Move spin ${n} up` }).click(); await p.waitForTimeout(1200);
rows = await getRows();
ok(`↑ on spin ${n} swaps it with spin ${n - 1}`, nm(items, rows[n - 2].reel1) === was[1] && nm(items, rows[n - 1].reel1) === was[0], `${nm(items, rows[n - 2].reel1)} / ${nm(items, rows[n - 1].reel1)}`);
await p.locator(".sc-row").nth(n - 2).getByRole("button", { name: `Move spin ${n - 1} down` }).click(); await p.waitForTimeout(1200);
rows = await getRows();
ok("↓ moves it back", nm(items, rows[n - 1].reel1) === was[1]);
ok("↑ disabled on spin 1, ↓ disabled on the last", await p.getByRole("button", { name: "Move spin 1 up" }).isDisabled() && await p.getByRole("button", { name: `Move spin ${n} down` }).isDisabled());

// Delete asks first
const count = (await getRows()).length;
await p.locator(".sc-row").last().getByRole("button", { name: /Delete spin/ }).click(); await p.waitForTimeout(300);
const cf = p.locator("dialog.cf[open]").filter({ hasText: "Delete spin" });
ok("delete shows a confirmation", await cf.isVisible(), await cf.locator("h2").innerText().catch(() => ""));
await p.screenshot({ path: `${OUT}/admin-delete-confirm.png` });
await cf.getByRole("button", { name: "Cancel" }).click(); await p.waitForTimeout(600);
ok("Cancel keeps the spin", (await getRows()).length === count);
await p.locator(".sc-row").last().getByRole("button", { name: /Delete spin/ }).click(); await p.waitForTimeout(300);
await p.locator("dialog.cf[open]").getByRole("button", { name: "Delete spin" }).click(); await p.waitForTimeout(1200);
ok("Delete spin removes it", (await getRows()).length === count - 1);

// clean up
await r.put(BASE + "/api/admin/script", { data: { rows: prev.map(({ reel1, reel2, reel3, enabled, note }) => ({ reel1, reel2, reel3, enabled, note })) } });
for (const i of (await getItems()).filter((x) => !before.some((y) => y.id === x.id))) await r.delete(`${BASE}/api/admin/items/${i.id}`);
ok("cleaned up", (await getItems()).length === before.length);
await b.close();
