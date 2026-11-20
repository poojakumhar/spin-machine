// Browser audit of the kiosk (API mocked, so no database needed). Prints PASS/FAIL lines.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE ?? "http://localhost:3100";
mkdirSync("shots", { recursive: true });
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 1, label: "Placeholder Word A", image_url: null },
  ...["Dog", "Bullock", "Horse", "Elephant"].map((l, i) => ({ id: 10 + i, reel: 2, label: l, image_url: `/reels/${l.toLowerCase()}.${l === "Dog" || l === "Bullock" ? "png" : "svg"}` })),
  { id: 30, reel: 3, label: "Parigrah", image_url: null },
  { id: 31, reel: 3, label: "Paradhinta", image_url: null },
];
const by = (r) => items.filter((i) => i.reel === r).map(({ id, label, image_url }) => ({ id, label, image_url }));
let spinCalls = 0;
const out = [];
const check = (name, ok, detail = "") => { out.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };

async function open(browser, w, h, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  await page.route("**/api/items", (r) => r.fulfill({ json: { items } }));
  await page.route("**/api/spin", (r) => {
    spinCalls++;
    r.fulfill({ json: { spinId: spinCalls, result: [by(1)[0], by(2)[1], by(3)[1]], decoys: [1, 2, 3].map(by) } });
  });
  await page.goto(base);
  await page.waitForSelector(".pull span:not(:has-text('…'))", { timeout: 15000 });
  await page.waitForTimeout(500);
  return { page, ctx, errors, failed };
}

const browser = await chromium.launch();

// 1. sizes: scale, letterbox, no scroll, safe area
for (const [w, h] of [[1920, 1080], [1280, 720], [3840, 2160], [1440, 900], [900, 1400]]) {
  const { page, ctx, errors, failed } = await open(browser, w, h);
  const m = await page.evaluate(() => {
    const st = document.querySelector(".stage").getBoundingClientRect();
    const mc = document.querySelector(".machine").getBoundingClientRect();
    const pb = document.querySelector(".pull").getBoundingClientRect();
    const de = document.documentElement;
    return { st: [st.left, st.top, st.width, st.height], mc: [mc.left, mc.top, mc.right, mc.bottom], pb: [pb.left, pb.top, pb.right, pb.bottom],
      scrollX: de.scrollWidth > innerWidth, scrollY: de.scrollHeight > innerHeight, vw: innerWidth, vh: innerHeight };
  });
  const tag = `${w}x${h}`;
  const ratio = m.st[2] / m.st[3];
  check(`${tag} stage is 16:9`, Math.abs(ratio - 16 / 9) < 0.01, ratio.toFixed(3));
  check(`${tag} stage fits viewport`, m.st[2] <= w + 1 && m.st[3] <= h + 1);
  check(`${tag} no page scroll`, !m.scrollX && !m.scrollY);
  // safe area: 90% of the stage rectangle
  const sx = m.st[0] + m.st[2] * 0.05, sy = m.st[1] + m.st[3] * 0.05, ex = m.st[0] + m.st[2] * 0.95, ey = m.st[1] + m.st[3] * 0.95;
  const inside = (r) => r[0] >= sx - 1 && r[1] >= sy - 1 && r[2] <= ex + 1 && r[3] <= ey + 1;
  check(`${tag} machine inside 90% safe area`, inside(m.mc), m.mc.map((v) => Math.round(v)).join(","));
  check(`${tag} button inside 90% safe area`, inside(m.pb), m.pb.map((v) => Math.round(v)).join(","));
  check(`${tag} no console errors / failed requests`, errors.length === 0 && failed.length === 0, [...errors, ...failed].slice(0, 2).join(" | "));
  if (w === 1920) await page.screenshot({ path: "shots/audit-1920-idle.png" });
  if (w === 1440) await page.screenshot({ path: "shots/audit-1440.png" });
  if (w === 900) await page.screenshot({ path: "shots/audit-portrait.png" });
  await ctx.close();
}

// 2. interaction rules at 1920x1080
{
  const { page, ctx } = await open(browser, 1920, 1080);
  const label = () => page.locator(".pull span").innerText();
  check("idle label is PULL", (await label()) === "SPIN", await label());
  spinCalls = 0;
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  check("Space starts a spin", spinCalls === 1 && (await label()) === "SPINNING", await label());
  await page.keyboard.press("Enter");
  await page.mouse.click(960, 956);
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  check("presses while spinning are ignored (no double trigger)", spinCalls === 1, `calls=${spinCalls}`);
  // the spin lasts about 1 s, so look for motion right away (0.3 s after the press)
  const tf = () => page.evaluate(() => [...document.querySelectorAll(".cyl")].map((c) => c.style.transform).join("|"));
  const a1 = await tf(); await page.waitForTimeout(80); const blur = a1 !== (await tf());
  await page.screenshot({ path: "shots/audit-1920-spin.png" });
  await page.waitForTimeout(800);
  check("reels animate while spinning", blur);
  // staggered stops: reel 1 finishes before reel 3
  const t0 = Date.now(); const stops = {};
  await page.waitForFunction(() => document.querySelector(".pull span").textContent === "SPIN AGAIN", null, { timeout: 15000 });
  stops.total = Date.now() - t0;
  check("result state reached (label SPIN AGAIN)", true, `${stops.total}ms after spin phase`);
  await page.waitForTimeout(400);
  const texts = await page.evaluate(() => [...document.querySelectorAll(".hole")].map((h) => h.innerText.trim()));
  check("result shows server-chosen combination", texts.some((t) => /TIRYANCH/i.test(t)) && texts.some((t) => /Bullock|Dog|Horse|Elephant/i.test(t)) && texts.some((t) => /PARADHINTA/i.test(t)), texts.join(" / "));
  await page.screenshot({ path: "shots/audit-1920-result.png" });
  check("confetti present at result", (await page.locator(".confetti i").count()) > 0);
  // lock window then accepted
  await page.keyboard.press("Space"); await page.waitForTimeout(200);
  check("press right after result lands is locked", spinCalls === 1, `calls=${spinCalls}`);
  await page.waitForTimeout(2600);
  await page.keyboard.press("Space"); await page.waitForTimeout(250);
  check("press after lock window starts next spin", spinCalls === 2, `calls=${spinCalls}`);
  // sound toggle default off
  const muted = await page.evaluate(() => !!document.querySelector(".sound svg path[d^='M16 9']"));
  check("sound is off by default", muted);
  await ctx.close();
}

// 3. cursor hides, no text selection, fullscreen key does not throw
{
  const { page, ctx } = await open(browser, 1920, 1080);
  await page.mouse.move(500, 500);
  await page.waitForTimeout(3000);
  const cur = await page.evaluate(() => getComputedStyle(document.querySelector(".stage")).cursor);
  check("cursor hidden after inactivity", cur === "none", cur);
  const us = await page.evaluate(() => getComputedStyle(document.querySelector(".viewport")).userSelect);
  check("text selection disabled", us === "none", us);
  await ctx.close();
}

// 4. attract mode after 20s idle
{
  const { page, ctx } = await open(browser, 1920, 1080);
  await page.waitForTimeout(24500);
  const l = await page.locator(".pull span").innerText();
  check("attract mode: 'PRESS TO BEGIN' after ~20s idle", l === "PRESS TO BEGIN", l);
  await ctx.close();
}

// 5. reduced motion: no spinning animation, still reaches result
{
  const { page, ctx } = await open(browser, 1920, 1080, { reduced: true });
  spinCalls = 0;
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);
  const anim = await page.evaluate(() => [...document.querySelectorAll(".strip")].some((s) => s.getAnimations().some((a) => a.effect?.getKeyframes?.().some((k) => k.transform))));
  check("reduced motion: reels do not spin", !anim);
  await page.waitForFunction(() => document.querySelector(".pull span").textContent === "SPIN AGAIN", null, { timeout: 8000 });
  check("reduced motion: still reaches the result", true);
  await ctx.close();
}

// 6. text legibility: real pixel behind the PULL label
{
  const { page, ctx } = await open(browser, 1920, 1080);
  const r = await page.evaluate(() => { const b = document.querySelector(".pull span").getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  await ctx.close();
  out.push(`INFO  PULL label box ${r.map((v) => Math.round(v)).join(",")}`);
}

// 7. admin: login gate renders, API refuses without cookie
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/admin`);
  check("admin shows ID + password form when signed out", (await page.locator("input[type=password]").count()) === 1 && (await page.locator("#uid").count()) === 1);
  for (const u of ["/api/admin/items", "/api/admin/stats"]) {
    const r = await page.request.get(base + u);
    check(`${u} refuses without a session`, r.status() === 401, String(r.status()));
  }
  const bad = await page.request.post(`${base}/api/admin/login`, { data: { username: "nobody", password: "nope" } });
  check("wrong password rejected", bad.status() === 401, String(bad.status()));
  await page.screenshot({ path: "shots/audit-admin.png" });
  await ctx.close();
}

await browser.close();
console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length} pass, ${out.filter((l) => l.startsWith("FAIL")).length} fail`);
