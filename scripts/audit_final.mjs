import { chromium } from "playwright";
const all = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null }, { id: 2, reel: 2, label: "Bullock", image_url: "/reels/bullock.png" }, { id: 3, reel: 3, label: "Paradhinta", image_url: null },
  { id: 4, reel: 1, label: "Placeholder Word A", image_url: null }, { id: 5, reel: 2, label: "Dog", image_url: "/reels/dog.png" }, { id: 6, reel: 3, label: "Parigrah", image_url: null },
];
const pick = (r) => all.filter((i) => i.reel === r).map(({ id, label, image_url }) => ({ id, label, image_url }));
const b = await chromium.launch();
for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.route("**/api/items", (r) => r.fulfill({ json: { items: all } }));
  await p.route("**/api/spin", (r) => r.fulfill({ json: { spinId: 1, result: [pick(1)[1], pick(2)[0], pick(3)[0]], decoys: [pick(1), pick(2), pick(3)] } }));
  await p.goto("http://localhost:3100"); await p.waitForSelector(".pull span:not(:has-text('…'))"); await p.waitForTimeout(800);
  await p.screenshot({ path: `shots/final-${w}-idle.png` });
  await p.keyboard.press("Space"); await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/final-${w}-spin.png` });
  await p.waitForFunction(() => document.querySelector(".pull span").textContent === "PULL AGAIN", null, { timeout: 15000 });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `shots/final-${w}-result.png` });
  await p.close();
}
await b.close();
