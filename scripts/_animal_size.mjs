import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("http://localhost:3100/"); await p.waitForSelector(".pull span:not(:has-text('…'))"); await p.waitForTimeout(900);
const r = await p.evaluate(() => {
  const front = [...document.querySelectorAll(".hole-animal .cyl")].sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
  const img = front.querySelector("img.animal"), box = front.getBoundingClientRect(), ir = img.getBoundingClientRect();
  const name = front.querySelector(".name").getBoundingClientRect();
  return { box: Math.round(box.height), img: [Math.round(ir.width), Math.round(ir.height), Math.round(ir.top), Math.round(ir.bottom)], nameMid: Math.round((name.top + name.bottom) / 2) };
});
console.log(JSON.stringify(r)); await b.close();
