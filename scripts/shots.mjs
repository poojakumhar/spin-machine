// Visual check: screenshots of the kiosk at several sizes. API is mocked unless LIVE=1.
// usage: node scripts/shots.mjs <outDir>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? "http://localhost:3100";
const animals = ["Dog", "Bullock", "Horse", "Elephant", "Camel", "Goat", "Parrot", "Deer"];
const items = [
  ...[["Tiryanch", null], ["Placeholder Word A", null]].map(([l, u], i) => ({ id: 1 + i, reel: 1, label: l, image_url: u })),
  ...animals.map((l, i) => ({ id: 10 + i, reel: 2, label: l, image_url: `/reels/${l.toLowerCase()}.${l === "Dog" || l === "Bullock" ? "png" : "svg"}` })),
  ...[["Parigrah", null], ["Paradhinta", null]].map(([l, u], i) => ({ id: 30 + i, reel: 3, label: l, image_url: u })),
];
const cell = (i) => ({ id: i.id, label: i.label, image_url: i.image_url });
const pick = (r) => items.filter((i) => i.reel === r);

const browser = await chromium.launch();
const sizes = [[1920, 1080], [1280, 720], [1440, 900], [3840, 2160]];
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  if (!process.env.LIVE) {
    await page.route("**/api/items", (r) => r.fulfill({ json: { items } }));
    await page.route("**/api/spin", (r) =>
      r.fulfill({ json: { spinId: 1, result: [cell(pick(1)[0]), cell(pick(2)[1]), cell(pick(3)[1])], decoys: [1, 2, 3].map((n) => pick(n).map(cell)) } }),
    );
  }
  await page.goto(base);
  await page.waitForSelector(".pull span:not(:has-text('…'))");
  await page.waitForTimeout(600);
  const tag = `${w}x${h}`;
  await page.screenshot({ path: `${out}/${tag}-idle.png` });
  if (w === 1920 || w === 1280) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/${tag}-spin.png` });
    await page.waitForTimeout(4600);
    await page.screenshot({ path: `${out}/${tag}-result.png` });
  }
  await page.close();
}
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${base}/admin`);
await page.screenshot({ path: `${out}/admin-login.png` });
await browser.close();
console.log("shots done");
