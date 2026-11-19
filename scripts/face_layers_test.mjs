import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const items = [{ id: 1, reel: 1, label: "A", image_url: null }, { id: 2, reel: 2, label: "B", image_url: null }, { id: 3, reel: 3, label: "C", image_url: null }];
const variants = {
  base: "",
  "inset off": ":root{--face-inset:0}",
  "side gradient off": ":root{--face-edge-x:0}",
  "top/bottom gradient off": ":root{--face-edge-y:0}",
  "highlight off": ":root{--face-hi:0}",
  "all CSS gradients off (noise + base only)": ":root{--face-inset:0;--face-edge-x:0;--face-edge-y:0;--face-hi:0}",
  "noise off (gradients only)": ".face{background-image: var(--nonoise) !important}",
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
await p.goto("http://localhost:3100");
await p.waitForSelector(".pull span:not(:has-text('…'))");
await p.waitForTimeout(600);
// build a "no noise" background-image by dropping the first (top) layer of the computed value
const noNoise = await p.evaluate(() => {
  const bi = getComputedStyle(document.querySelector(".face")).backgroundImage;
  let depth = 0, cut = -1;
  for (let i = 0; i < bi.length; i++) { const c = bi[i]; if (c === "(") depth++; else if (c === ")") depth--; else if (c === "," && depth === 0) { cut = i; break; } }
  return bi.slice(cut + 1).trim();
});
writeFileSync("shots/face/_nonoise.txt", noNoise.slice(0, 80));
const base = ".hole,.pull,.sound,.confetti{visibility:hidden !important}";
let i = 0;
for (const [name, css] of Object.entries(variants)) {
  const c = css.replace("var(--nonoise)", noNoise);
  await p.evaluate(() => document.getElementById("vt")?.remove());
  await p.evaluate(([t]) => { const s = document.createElement("style"); s.id = "vt"; s.textContent = t; document.head.appendChild(s); }, [base + c]);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `shots/face/v${i}.png` });
  await p.evaluate(() => { document.getElementById("vt").textContent += ".frame-front{display:none !important}"; });
  await p.waitForTimeout(150);
  await p.screenshot({ path: `shots/face/v${i}-nofront.png` });
  writeFileSync(`shots/face/v${i}.name`, name);
  i++;
}
writeFileSync("shots/face/variants.count", String(i));
await b.close();
console.log("variants", i);
