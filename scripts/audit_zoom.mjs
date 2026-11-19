import { chromium } from "playwright";
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 2, label: "Bullock", image_url: "/reels/bullock.png" },
  { id: 3, reel: 3, label: "Paradhinta", image_url: null },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
await p.goto(process.env.BASE ?? "http://localhost:3100");
await p.waitForSelector(".pull span:not(:has-text('…'))");
await p.waitForTimeout(900);
const clips = { left: [200, 60, 220, 850], right: [1500, 60, 230, 850], mid: [690, 60, 540, 850], full: [0, 0, 1920, 1080] };
for (const [k, [x, y, w, h]] of Object.entries(clips)) await p.screenshot({ path: `shots/zoom-${k}.png`, clip: { x, y, width: w, height: h } });
await b.close();
