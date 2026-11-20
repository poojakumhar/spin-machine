import { chromium } from "playwright";
const FILE = "file:///C:/Users/DesignTeam/Downloads/slot-machine-preview.html";
const b = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });   // strict: sound only after a tap, like phones
for (const [name, vp, mobile] of [["phone", { width: 844, height: 390 }, true], ["desktop", { width: 1920, height: 1080 }, false]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__clips = [];
    const C = window.AudioContext, ob = C.prototype.createBufferSource;
    C.prototype.createBufferSource = function () { const s = ob.call(this), st = s.start.bind(s); s.start = (...x) => { window.__clips.push({ sec: +(s.buffer?.duration ?? 0).toFixed(2), loop: s.loop, state: this.state }); return st(...x); }; return s; };
  });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(FILE); await p.waitForSelector(".pull span:not(:has-text('…'))", { timeout: 15000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `C:/Users/DesignTeam/slot-machine/shots/preview-${name}-idle.png` });
  if (mobile) await p.tap(".sound", { force: true }); else await p.click(".sound", { force: true });
  await p.waitForTimeout(300);
  if (mobile) await p.tap(".pull", { force: true }); else await p.click(".pull", { force: true });
  await p.waitForTimeout(1200); await p.screenshot({ path: `C:/Users/DesignTeam/slot-machine/shots/preview-${name}-spin.png` });
  await p.waitForFunction(() => document.querySelector(".pull span").textContent === "SPIN AGAIN", null, { timeout: 15000 });
  await p.addStyleTag({ content: ".confetti{display:none!important}" }); await p.waitForTimeout(500);
  await p.screenshot({ path: `C:/Users/DesignTeam/slot-machine/shots/preview-${name}-result.png` });
  const labels = await p.evaluate(() => [...document.querySelectorAll(".machine .hole:not(.hole-scene)")].map((h) => [...h.children].sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0].querySelector(".word,.name").innerText));
  const font = await p.evaluate(() => getComputedStyle(document.querySelector(".word")).fontFamily);
  console.log(name, "| result:", labels.join(" · "), "| spin clip:", JSON.stringify(await p.evaluate(() => window.__clips)), "| font:", font, "| errors:", errs.join(" ; ") || "none");
  await ctx.close();
}
await b.close();
