// Opens the kiosk the way a phone would (iPhone and Android sizes, portrait and landscape, touch) and reports
// load errors, sideways overflow and whether the PULL button is on screen. Never pulls (safe on the live site).
import { chromium, devices } from "playwright";
const URL = process.argv[2] ?? "http://localhost:3100/";
const OUT = process.argv[3] ?? "shots";
const b = await chromium.launch();
for (const [name, dev] of [["iphone", devices["iPhone 13"]], ["android", devices["Pixel 7"]]]) {
  for (const land of [false, true]) {
    const vp = land ? { width: dev.viewport.height, height: dev.viewport.width } : dev.viewport;
    const ctx = await b.newContext({ ...dev, viewport: vp });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("page: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
    p.on("requestfailed", (r) => errs.push("failed: " + r.url()));
    const t0 = Date.now();
    await p.goto(URL, { waitUntil: "load" });
    const ready = await p.waitForFunction(() => /SPIN|PRESS/.test(document.querySelector(".pull span")?.textContent ?? ""), null, { timeout: 20000 }).then(() => true, () => false);
    const info = await p.evaluate(() => {
      const btn = document.querySelector(".pull")?.getBoundingClientRect();
      const label = document.querySelector(".pull span")?.textContent;
      return {
        label,
        scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
        vw: innerWidth, vh: innerHeight,
        btn: btn ? { top: Math.round(btn.top), bottom: Math.round(btn.bottom), left: Math.round(btn.left), right: Math.round(btn.right) } : null,
      };
    });
    const tag = `${name}-${land ? "landscape" : "portrait"}`;
    await p.screenshot({ path: `${OUT}/phone-${tag}.png` });
    const onScreen = info.btn && info.btn.top >= 0 && info.btn.bottom <= info.vh && info.btn.left >= 0 && info.btn.right <= info.vw;
    console.log(`${tag} ${info.vw}x${info.vh}: ready=${ready} in ${((Date.now() - t0) / 1000).toFixed(1)}s, button "${info.label}" ${onScreen ? "on screen" : "OFF SCREEN " + JSON.stringify(info.btn)}, page ${info.scrollW}x${info.scrollH}${info.scrollW > info.vw ? " (SIDEWAYS SCROLL)" : ""}${info.scrollH > info.vh ? " (VERTICAL SCROLL)" : ""}`);
    if (errs.length) console.log("   errors:", errs.slice(0, 5).join(" | "));
    await ctx.close();
  }
}
await b.close();
