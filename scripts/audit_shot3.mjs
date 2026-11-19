// Bottom strip at 2x with Horse in the middle, to compare with a user screenshot.
import { chromium } from "playwright";
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 2, label: "Horse", image_url: "/reels/horse.svg" },
  { id: 3, reel: 3, label: "Parigrah", image_url: null },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
await p.goto(process.env.BASE ?? "http://localhost:3100");
await p.waitForSelector(".pull span:not(:has-text('…'))");
await p.waitForTimeout(800);
await p.screenshot({ path: "shots/z-strip.png", clip: { x: 200, y: 640, width: 1520, height: 270 } });
await b.close();
