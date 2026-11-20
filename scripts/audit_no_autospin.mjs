// The reels never turn on their own: waits past the 20 s idle mark with no input and checks the reel drawing never changes.
// Uses ?demo so nothing is recorded (safe on the live site).
import { chromium } from "playwright";
const URL = (process.argv[2] ?? "http://localhost:3100/") + "?demo";
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(URL);
await p.waitForFunction(() => document.querySelector(".pull span")?.textContent === "PULL", null, { timeout: 20000 });
await p.waitForTimeout(1000);
await p.evaluate(() => {
  const holes = () => [...document.querySelectorAll(".machine .hole")].filter((h) => !h.classList.contains("hole-scene"));
  const snap = () => holes().map((h) => [...h.children].map((c) => c.style.transform).join("|")).join("#");
  const first = snap(); window.__changes = 0;
  const tick = () => { if (snap() !== first) window.__changes++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await p.waitForTimeout(30000);
const label = await p.locator(".pull span").innerText();
const changes = await p.evaluate(() => window.__changes);
ok("reels stay still for 30 s with nobody pulling", changes === 0, `${changes} changed frames`);
ok("button switches to PRESS TO BEGIN when idle", label === "PRESS TO BEGIN", label);
await b.close();
