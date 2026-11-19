// After the last reel stops: the front word must stay fully visible, and the neighbours must fade out.
import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("http://localhost:3100/"); await p.waitForSelector(".pull span:not(:has-text('…'))"); await p.waitForTimeout(800);
await p.keyboard.press("Space");
await p.waitForFunction(() => document.querySelector(".pull span").textContent === "PULL AGAIN", null, { timeout: 15000 });
const samples = [];
for (let k = 0; k < 14; k++) {
  samples.push(await p.evaluate(() => [...document.querySelectorAll(".machine .hole:not(.hole-scene)")].map((h) => {
    const items = [...h.children].filter((c) => c.style.visibility !== "hidden");
    const op = items.map((c) => parseFloat(getComputedStyle(c).opacity));
    const front = Math.max(...items.map((c) => Number(c.style.zIndex)));
    const f = items.find((c) => Number(c.style.zIndex) === front);
    return { front: parseFloat(getComputedStyle(f).opacity).toFixed(2), others: op.filter((_, i) => items[i] !== f).map((x) => x.toFixed(2)).join(",") };
  })));
  await p.waitForTimeout(60);
}
const minFront = Math.min(...samples.flat().map((s) => +s.front));
console.log("lowest front-word opacity in the 0.85 s after the result:", minFront);
console.log("neighbours at the end:", samples.at(-1).map((s) => s.others || "none"));
await b.close();
