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
await p.screenshot({ path: "shots/mid.png", clip: { x: 690, y: 60, width: 560, height: 840 } });
// also the frame alone (hide live content) to see the bare frame
await p.addStyleTag({ content: ".hole{display:none !important}" });
await p.screenshot({ path: "shots/mid-bare.png", clip: { x: 690, y: 60, width: 560, height: 840 } });
await b.close();
