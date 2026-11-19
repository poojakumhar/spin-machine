// Renders Tiryanch / Dog / Parigrah like the user's screenshot, at 2x for zooming. Writes shots/z-*.png
import { chromium } from "playwright";
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 2, label: "Dog", image_url: "/reels/dog.png" },
  { id: 3, reel: 3, label: "Parigrah", image_url: null },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
await p.goto(process.env.BASE ?? "http://localhost:3100");
await p.waitForSelector(".pull span:not(:has-text('…'))");
await p.waitForTimeout(800);
await p.screenshot({ path: "shots/z-full.png" });
const crops = { bottomL: [230, 700, 720, 260], bottomM: [720, 700, 560, 260], bottomR: [1210, 560, 520, 360], d3left: [1200, 280, 220, 520], dog: [720, 160, 520, 600] };
for (const [k, [x, y, w, h]] of Object.entries(crops)) await p.screenshot({ path: `shots/z-${k}.png`, clip: { x, y, width: w, height: h } });
await b.close();
