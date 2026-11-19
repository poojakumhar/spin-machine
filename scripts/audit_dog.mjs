import { chromium } from "playwright";
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null }, { id: 2, reel: 2, label: "Dog", image_url: "/reels/dog.png" }, { id: 3, reel: 3, label: "Parigrah", image_url: null },
  { id: 4, reel: 1, label: "Placeholder Word A", image_url: null }, { id: 5, reel: 3, label: "Paradhinta", image_url: null }, { id: 6, reel: 2, label: "Elephant", image_url: "/reels/elephant.svg" },
];
const b = await chromium.launch();
for (const [w, h, set] of [[1920, 1080, [0, 1, 2]], [1920, 1080, [3, 5, 4]]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.route("**/api/items", (r) => r.fulfill({ json: { items: set.map((i) => items[i]) } }));
  await p.goto("http://localhost:3100");
  await p.waitForSelector(".pull span:not(:has-text('…'))"); await p.waitForTimeout(800);
  await p.screenshot({ path: `shots/fix-${set.join("")}.png` });
  await p.close();
}
await b.close();
