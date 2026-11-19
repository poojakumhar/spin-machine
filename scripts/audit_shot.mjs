// Renders the kiosk showing Tiryanch / Bullock / Paradhinta (same as the reference) at 1920x1080 with fake data.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:3100";
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 2, label: "Bullock", image_url: "/reels/bullock.png" },
  { id: 3, reel: 3, label: "Paradhinta", image_url: null },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
await p.goto(base);
await p.waitForSelector(".pull span:not(:has-text('…'))");
await p.waitForTimeout(800);
await p.screenshot({ path: "shots/audit-mine.png" });
await b.close();
