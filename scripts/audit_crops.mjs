// 200% crops of corners, seams and bottom edges. node scripts/audit_crops.mjs  (machine: left 240, top 54, scale 1440/1468)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 2, label: "Bullock", image_url: "/reels/bullock.png" },
  { id: 3, reel: 3, label: "Paradhinta", image_url: null },
];
mkdirSync("shots/face/crops", { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
await p.goto(process.env.BASE ?? "http://localhost:3100");
await p.waitForSelector(".pull span:not(:has-text('…'))");
await p.waitForTimeout(800);
const S = 1440 / 1468, X0 = 240, Y0 = 54;
const R = (x, y) => [X0 + x * S, Y0 + y * S];
const crops = {
  "top-left": [R(10, 0), 260, 200], "top-right": [R(1200, 0), 260, 200],
  "top-d2-left": [R(440, 0), 200, 160], "top-d2-right": [R(900, 0), 200, 160],
  "bottom-left": [R(10, 700), 330, 190], "bottom-mid": [R(440, 700), 330, 190], "bottom-right": [R(1100, 700), 330, 190],
  "bottom-seam1": [R(400, 740), 200, 140], "bottom-seam2": [R(880, 740), 200, 140],
};
for (const [k, [[x, y], w, h]] of Object.entries(crops)) await p.screenshot({ path: `shots/face/crops/${k}.png`, clip: { x, y, width: w, height: h } });
await b.close();
