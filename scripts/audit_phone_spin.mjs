// A spin on a phone (touch, phone size), with sound on: when each reel stops and when the spin sound starts/stops.
// Uses ?demo so nothing is recorded (safe on the live site).
import { chromium, devices } from "playwright";
const URL = (process.argv[2] ?? "http://localhost:3100/") + "?demo";
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
for (const [name, dev] of [["iphone", devices["iPhone 13"]], ["android", devices["Pixel 7"]]]) {
  const ctx = await b.newContext({ ...dev, viewport: { width: dev.viewport.height, height: dev.viewport.width } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__clips = [];
    const C = window.AudioContext || window.webkitAudioContext;
    const ob = C.prototype.createBufferSource;
    C.prototype.createBufferSource = function () {
      const s = ob.call(this); const st = s.start.bind(s), sp = s.stop.bind(s);
      s.start = (...a) => { window.__clips.push({ ev: "start", at: performance.now(), loop: s.loop, sec: s.buffer?.duration }); return st(...a); };
      s.stop = (...a) => { window.__clips.push({ ev: "stop", at: performance.now() }); return sp(...a); };
      return s;
    };
    const oe = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__clips.push({ ev: "media-play", at: performance.now(), loop: this.loop, src: this.src }); return oe.call(this); };
    const op = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () { window.__clips.push({ ev: "media-pause", at: performance.now() }); return op.call(this); };
  });
  await p.goto(URL);
  await p.waitForFunction(() => document.querySelector(".pull span")?.textContent === "SPIN", null, { timeout: 20000 });
  await p.tap(".sound", { force: true }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    const holes = () => [...document.querySelectorAll(".machine .hole")].filter((h) => !h.classList.contains("hole-scene"));
    let last = holes().map((h) => [...h.children].map((c) => c.style.transform).join("|"));
    const lastChange = [0, 0, 0], moved = [false, false, false]; window.__stops = [null, null, null];
    const tick = () => {
      const now = performance.now();
      holes().forEach((h, i) => {
        const s = [...h.children].map((c) => c.style.transform).join("|");
        if (s !== last[i]) { last[i] = s; lastChange[i] = now; moved[i] = true; }
        else if (moved[i] && window.__stops[i] === null && now - lastChange[i] > 150) window.__stops[i] = lastChange[i];
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__clips = [];
  });
  const t0 = await p.evaluate(() => performance.now());
  await p.tap(".pull", { force: true });
  await p.waitForFunction(() => document.querySelector(".pull span").textContent === "SPIN AGAIN", null, { timeout: 20000 });
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({ stops: window.__stops, clips: window.__clips }));
  const s = (t) => ((t - t0) / 1000).toFixed(2) + "s";
  console.log(`${name}: reels stop at ${r.stops.map((x) => (x ? s(x) : "-")).join(", ")}`);
  console.log(`   sound: ${r.clips.map((c) => `${c.ev} ${s(c.at)}${c.loop !== undefined ? ` loop=${c.loop}` : ""}${c.sec ? ` (${c.sec.toFixed(2)}s clip)` : ""}`).join(" | ") || "none"}`);
  await ctx.close();
}
await b.close();
