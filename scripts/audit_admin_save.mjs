// Admin row editing: a name or image change shows Save/Cancel, nothing is stored until Save, Save stores both.
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "shots";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
await p.goto(BASE + "/admin");
await p.fill("input[type=email], input[name=username], #u", "admin@gmail.com").catch(() => {});
const inputs = p.locator("form input");
if (await inputs.count() >= 2) { await inputs.nth(0).fill("admin@gmail.com"); await inputs.nth(1).fill("admin@123"); await p.keyboard.press("Enter"); }
await p.waitForSelector(".rl-row .lf input", { timeout: 20000 });
await p.click("#tab-2"); await p.waitForTimeout(400);
const row = p.locator(".rl-row").first();
const input = row.locator(".lf input"); const orig = await input.inputValue();
const stored = async () => (await (await p.request.get(BASE + "/api/admin/items")).json()).items.find((i) => i.label === orig || i.label === orig + " X");
ok("no Save button before a change", (await row.getByRole("button", { name: "Save" }).count()) === 0);
await input.fill(orig + " X"); await input.blur(); await p.waitForTimeout(400);
ok("Save appears after editing the name", await row.getByRole("button", { name: "Save" }).isVisible());
ok("name not stored before Save", (await stored()).label === orig);
await row.locator('input[type=file]').setInputFiles("public/reels/dog.png");
await p.waitForTimeout(300);
ok("picked image shows as a draft", await row.locator(".thumb-btn.changed").count() === 1);
await row.screenshot({ path: `${OUT}/admin-row-unsaved.png` });
await row.getByRole("button", { name: "Save" }).click();
await p.waitForFunction(() => !document.querySelector(".rl-row .lf-note"), null, { timeout: 15000 });
const s = await stored();
ok("Save stores the name", s.label === orig + " X", s.label);
ok("Save stores the new image", /^\/api\/img\//.test(s.image_url ?? ""), s.image_url);
const img = await p.request.get(BASE + s.image_url);
ok("uploaded image is served", img.status() === 200 && img.headers()["content-type"] === "image/png", `${img.status()} ${img.headers()["content-type"]}`);
await row.screenshot({ path: `${OUT}/admin-row-saved.png` });
// Cancel puts the saved values back
await input.fill("Temp"); await row.getByRole("button", { name: "Cancel" }).click();
ok("Cancel restores the name", (await input.inputValue()) === orig + " X");
// put the name back as it was (image stays the uploaded copy of the same picture only if it was dog.png before)
await input.fill(orig); await row.getByRole("button", { name: "Save" }).click(); await p.waitForTimeout(1200);
ok("name restored", (await stored()).label === orig);
console.log("ORIGINAL_IMAGE_NOTE", orig);
await b.close();
