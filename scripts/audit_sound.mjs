// Sound check without speakers: records every tone the kiosk plays (time, pitch, waveform, volume)
// and the moment each reel visually stops, then compares them.
import { chromium } from "playwright";
const URL = process.argv[2] ?? "http://localhost:3100/";
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.addInitScript(() => {
  window.__tones = [];
  const C = window.AudioContext;
  window.__clips = [];
  const ob = C.prototype.createBufferSource;
  C.prototype.createBufferSource = function () {
    const s = ob.call(this), ctx = this, st = s.start.bind(s), sp = s.stop.bind(s);
    s.start = (...x) => { window.__clips.push({ ev: "start", at: performance.now(), sec: s.buffer ? s.buffer.duration / s.playbackRate.value : undefined, loop: s.loop }); return st(...x); };
    s.stop = (when) => { window.__clips.push({ ev: "stop", at: performance.now() + Math.max(0, ((when ?? ctx.currentTime) - ctx.currentTime) * 1000) }); return sp(when); };
    return s;
  };
  const orig = C.prototype.createOscillator;
  C.prototype.createOscillator = function () {
    const o = orig.call(this);
    const sv = o.frequency.setValueAtTime.bind(o.frequency);
    let f = 0;
    o.frequency.setValueAtTime = (v, t) => { if (!f) f = v; return sv(v, t); };
    const start = o.start.bind(o);
    o.start = (when) => {
      const ctx = this;
      const delay = Math.max(0, (when ?? ctx.currentTime) - ctx.currentTime);
      window.__tones.push({ at: performance.now() + delay * 1000, freq: f || o.frequency.value, type: o.type, state: ctx.state });
      return start(when);
    };
    return o;
  };
});
const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(URL); await p.waitForSelector(".pull span:not(:has-text('…'))"); await p.waitForTimeout(800);

// 1. sound is off by default: a spin must be silent
await p.keyboard.press("Space");
await p.waitForFunction(() => document.querySelector(".pull span").textContent === "SPIN AGAIN", null, { timeout: 15000 });
const silent = await p.evaluate(() => window.__tones.length + window.__clips.length);
await p.waitForTimeout(9500);   // let the result time out back to idle

// 2. turn sound on with the speaker button, then spin while watching the reels
await p.click(".sound"); await p.waitForTimeout(300);
const t0 = await p.evaluate(() => { window.__tones = []; window.__clips = []; window.__stops = [null, null, null]; return performance.now(); });
await p.evaluate(() => {
  const holes = () => [...document.querySelectorAll(".machine .hole")].filter((h) => !h.classList.contains("hole-scene"));
  let last = holes().map((h) => [...h.children].map((c) => c.style.transform).join("|"));
  let lastChange = [0, 0, 0]; const stopped = [null, null, null]; let moved = [false, false, false];
  const tick = () => {
    const now = performance.now();
    holes().forEach((h, i) => {
      const s = [...h.children].map((c) => c.style.transform).join("|");
      if (s !== last[i]) { last[i] = s; lastChange[i] = now; moved[i] = true; }
      else if (moved[i] && stopped[i] === null && now - lastChange[i] > 150) stopped[i] = lastChange[i];
    });
    window.__lastChange = stopped;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const pressAt = await p.evaluate(() => performance.now());
await p.keyboard.press("Space");
await p.waitForFunction(() => document.querySelector(".pull span").textContent === "SPIN AGAIN", null, { timeout: 15000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({ tones: window.__tones, clips: window.__clips, stops: window.__lastChange }));
const ms = (t) => Math.round(t - pressAt);
console.log("sound off by default -> tones during first spin:", silent);
console.log("audio state:", r.tones[0]?.state ?? "no tones");
console.log("spin clip (ms):", r.clips.map((c) => `${c.ev} ${ms(c.at)}${c.sec ? ` (${c.sec.toFixed(2)} s, loop ${c.loop})` : ""}`).join(" | ") || "none");
console.log("tones after pressing PULL (ms, Hz, wave):");
r.tones.forEach((x) => console.log("  ", ms(x.at), Math.round(x.freq), x.type));
// a reel's last movement can be the 360ms neighbour fade; the real stop is the last transform change
console.log("reels stop moving at (ms):", r.stops.map(ms));
console.log("errors:", errs.join(" ; ") || "none");
await b.close();
