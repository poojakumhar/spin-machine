// Screenshots for the reel-face measurements. API is mocked.
//  node scripts/face_shots.mjs diag   -> shots/face/diag-*.png  (one layer switched off at a time, content hidden)
//  node scripts/face_shots.mjs proof  -> shots/face/<size>-{idle,result,facefront,facenofront}.png + rects json
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const mode = process.argv[2] ?? "proof";
const base = process.env.BASE ?? "http://localhost:3100";
const OUT = "shots/face";
mkdirSync(OUT, { recursive: true });
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 2, label: "Bullock", image_url: "/reels/bullock.png" },
  { id: 3, reel: 3, label: "Paradhinta", image_url: null },
];
const b = await chromium.launch();

async function open(w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
  await p.route("**/api/spin", (r) => r.fulfill({ json: { spinId: 1, result: items.map(({ id, label, image_url }) => ({ id, label, image_url })), decoys: [[], [], []] } }));
  await p.goto(base);
  await p.waitForSelector(".pull span:not(:has-text('…'))");
  await p.waitForTimeout(700);
  return p;
}
async function rects(p) {
  return p.evaluate(() => {
    const m = document.querySelector(".machine").getBoundingClientRect();
    return { cx: [289, 798, 1305], k: m.width / 1500, x0: m.left, y0: m.top };
  });
}
const hideContent = ".hole, .pull, .sound, .confetti { visibility: hidden !important; }";

if (mode === "diag") {
  const variants = {
    base: "",
    "no-back-layer": ".frame:not(.frame-front), .face { display: none !important; }",
    "no-front-layer": ".frame-front { display: none !important; }",
    "no-machine-filter": ".machine { filter: none !important; }",
  };
  const p = await open(1920, 1080);
  writeFileSync(`${OUT}/rects.json`, JSON.stringify(await rects(p)));
  for (const [name, css] of Object.entries(variants)) {
    const h = await p.addStyleTag({ content: hideContent + css });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/diag-${name}.png` });
    await p.addStyleTag({ content: ".frame-front{display:none !important}" + (name === "no-back-layer" ? "" : "") });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/diag-${name}-nofront.png` });
    await p.evaluate(() => document.querySelectorAll("style").forEach((s) => s.textContent.includes("visibility: hidden !important") || s.textContent.includes("frame-front{display") ? s.remove() : 0));
  }
  await b.close();
  console.log("diag shots done");
} else {
  for (const [w, h] of [[1920, 1080], [1280, 720]]) {
    const tag = `${w}x${h}`;
    const p = await open(w, h);
    await p.screenshot({ path: `${OUT}/${tag}-idle.png` });
    writeFileSync(`${OUT}/${tag}-rects.json`, JSON.stringify(await rects(p)));
    await p.addStyleTag({ content: hideContent });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/${tag}-facefront.png` });
    const s = await p.addStyleTag({ content: ".frame-front{display:none !important}" });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/${tag}-facenofront.png` });
    await p.close();
    const q = await open(w, h);
    await q.keyboard.press("Space");
    await q.waitForFunction(() => document.querySelector(".pull span").textContent === "SPIN AGAIN", null, { timeout: 15000 });
    await q.waitForTimeout(500);
    await q.addStyleTag({ content: ".confetti{display:none !important}" });
    await q.waitForTimeout(100);
    await q.screenshot({ path: `${OUT}/${tag}-result.png` });
    await q.close();
  }
  await b.close();
  console.log("proof shots done");
}
