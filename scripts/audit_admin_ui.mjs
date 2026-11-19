// Visual + accessibility audit of /admin: screenshots of every section and state at two viewports, plus automatic checks
// (horizontal overflow, touch-target size, WCAG A/AA via axe). Needs the server on LOCAL_DB=1 with dev-fill data.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.BASE ?? "http://localhost:3100";
const OUT = "shots/admin";
mkdirSync(OUT, { recursive: true });
const sizes = [[1280, 800], [768, 1024]];
const report = [];
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const jsonOk = (route, json, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });

const browser = await chromium.launch();

async function newPage(w, h, { auth = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  if (auth) await page.request.post(`${base}/api/admin/login`, { data: { username: "admin@gmail.com", password: "admin@123" } });
  return { ctx, page, errors };
}

async function checks(page, tag) {
  const o = await page.evaluate(() => {
    const vw = innerWidth;
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden],.sr-only,dialog:not([open])")) continue;
      if (r.right > vw + 1 || r.left < -1) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} right=${Math.round(r.right)}`);
    }
    const small = [];
    for (const el of document.querySelectorAll("button, a[href], input:not([type=hidden]):not([hidden]), [role=switch], [role=tab], [role=option], [role=combobox]")) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || cs.display === "none" || cs.visibility === "hidden" || el.closest(".sr-only,dialog:not([open])") || el.closest("label")?.querySelector("[hidden]")) continue;
      if (el.type === "file" || el.hasAttribute("hidden")) continue;
      if (r.height < 43.5 || r.width < 43.5) small.push(`${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const fs = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || cs.display === "none" || el.closest(".sr-only,.pv")) continue;
      if (parseFloat(cs.fontSize) < 14.9) fs.push(`${el.tagName.toLowerCase()} ${cs.fontSize} "${el.textContent.trim().slice(0, 20)}"`);
    }
    return { scrollX: document.documentElement.scrollWidth - vw, bad: [...new Set(bad)].slice(0, 6), small: [...new Set(small)].slice(0, 8), fs: [...new Set(fs)].slice(0, 5) };
  });
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const v = ax.violations.map((x) => `${x.id} (${x.nodes.length}): ${x.nodes[0].target.join(" ").slice(0, 70)}`);
  report.push({ tag, scrollX: o.scrollX, overflow: o.bad, smallTargets: o.small, smallText: o.fs, axe: v });
}

async function shot(page, tag, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 350);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: opts.full ?? false });
  await checks(page, tag);
}

for (const [w, h] of sizes) {
  const S = `${w}x${h}`;

  // login (signed out)
  { const { ctx, page } = await newPage(w, h, { auth: false }); await page.goto(`${base}/admin`); await page.waitForSelector("#uid"); await shot(page, `${S}-00-login`); await ctx.close(); }

  // loading: the three data requests never answer
  { const { ctx, page } = await newPage(w, h);
    for (const p of ["items", "script", "stats"]) await page.route(`**/api/admin/${p}`, () => {});
    await page.goto(`${base}/admin#reels`); await page.waitForSelector(".skel"); await shot(page, `${S}-01-reels-loading`); await ctx.close(); }

  // error banner (database not connected, the real message the server sends)
  { const { ctx, page } = await newPage(w, h);
    for (const p of ["items", "script", "stats"]) await page.route(`**/api/admin/${p}`, (r) => jsonOk(r, { error: "The database is not connected yet (DATABASE_URL is not set).", code: "db_missing" }, 503));
    await page.goto(`${base}/admin#reels`); await page.waitForSelector(".banner"); await shot(page, `${S}-02-error-banner`); await ctx.close(); }

  // empty states
  { const { ctx, page } = await newPage(w, h);
    await page.route("**/api/admin/items", (r) => jsonOk(r, { items: [] }));
    await page.route("**/api/admin/script", (r) => jsonOk(r, { rows: [], nextSpin: 1 }));
    await page.route("**/api/admin/stats", (r) => jsonOk(r, { total: 0, scripted: 0, nextSpin: 1, perItem: [], combos: [], history: [] }));
    await page.goto(`${base}/admin#reels`); await page.waitForSelector(".empty"); await shot(page, `${S}-03-reels-empty`, { full: true });
    await page.goto(`${base}/admin#stats`); await page.reload(); await page.waitForSelector(".empty"); await shot(page, `${S}-05-stats-empty`); await ctx.close(); }

  // populated (real local Postgres data)
  { const { ctx, page, errors } = await newPage(w, h);
    await page.goto(`${base}/admin#reels`); await page.waitForSelector(".rl-row .grip"); await shot(page, `${S}-10-reels-populated-r1`, { full: true });
    await page.click("#tab-2"); await page.waitForSelector(".thumb img"); await shot(page, `${S}-11-reels-populated-r2`, { full: true });
    // Add popup: opened from the button at the top right of the tab row
    const before = await page.locator('.rl-row .grip').count();
    await page.click('.tabs-add'); await page.waitForSelector('dialog[open] #add-label');
    await page.setInputFiles('dialog[open] input[type=file]', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.click('dialog[open] button[type=submit]'); await shot(page, `${S}-12-add-popup-errors`);
    await page.setInputFiles('dialog[open] input[type=file]', { name: 'camel.png', mimeType: 'image/png', buffer: png });
    await page.fill('#add-label', 'Zebra'); await shot(page, `${S}-13-add-popup-preview`);
    await page.click('dialog[open] button[type=submit]'); await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 1500 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('dialog.cf-wide[open]'), null, { timeout: 8000 });
    const after = await page.locator('.rl-row .grip').count();
    console.log(`ADD FLOW: popup closed after Add, rows ${before} -> ${after}, new row visible: ${await page.locator('.rl-row input[value=Zebra]').count() >= 1}`);
    await page.click('.tabs-add'); await page.waitForSelector('dialog[open] #add-label'); await page.keyboard.press('Escape');
    console.log(`ESC closes the popup: ${await page.locator('dialog.cf-wide[open]').count() === 0}`);
    await page.screenshot({ path: `${OUT}/${S}-11b-after-add.png` });
    // confirm dialog (delete), cancel
    await page.click("#tab-1"); await page.click(".rl-row >> nth=0 >> button[aria-label^='Delete']"); await page.waitForSelector("dialog[open]"); await shot(page, `${S}-14-confirm-delete`); await page.click("dialog[open] .btn-secondary");
    // (spin script screens are switched off in the UI: SCRIPT_UI=false)
    // stats + settings
    await page.goto(`${base}/admin#stats`); await page.reload(); await page.waitForSelector(".stat-strip"); await shot(page, `${S}-30-stats`, { full: true });
    await page.goto(`${base}/admin#settings`); await page.reload(); await page.waitForSelector(".set-block"); await shot(page, `${S}-40-settings`);
    await page.click("button:has-text('Delete history')"); await page.waitForSelector("dialog[open]"); await shot(page, `${S}-41-confirm-history`); await page.click("dialog[open] .btn-secondary");
    if (errors.length) report.push({ tag: `${S} console errors`, errors });
    await ctx.close(); }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const r of report) {
  if (r.errors) { console.log(`!! ${r.tag}: ${r.errors.join(" | ")}`); continue; }
  const problems = [r.scrollX > 0 && `h-scroll ${r.scrollX}px`, r.overflow.length && `overflow: ${r.overflow.join("; ")}`, r.smallTargets.length && `small targets: ${r.smallTargets.join("; ")}`, r.smallText.length && `small text: ${r.smallText.join("; ")}`, r.axe.length && `axe: ${r.axe.join(" | ")}`].filter(Boolean);
  console.log(`${problems.length ? "ISSUE" : "ok   "} ${r.tag}${problems.length ? "\n      " + problems.join("\n      ") : ""}`);
}
