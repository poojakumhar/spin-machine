// Vertical position (screen px) of each front label block: top divider, label text, bottom divider, per reel.
import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(process.argv[2] ?? "http://localhost:3100/"); await p.waitForSelector(".pull span:not(:has-text('…'))"); await p.waitForTimeout(900);
const rows = await p.evaluate(() => [...document.querySelectorAll(".machine .hole:not(.hole-scene)")].map((h) => {
  const f = [...h.children].sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
  const lab = f.querySelector(".word, .name");
  const block = lab.parentElement;
  const divs = [...block.children].filter((c) => c !== lab).map((d) => d.getBoundingClientRect());
  const rg = document.createRange(); rg.selectNodeContents(lab); const t = rg.getBoundingClientRect();
  const mid = (r) => Math.round((r.top + r.bottom) / 2 * 10) / 10;
  return { text: lab.innerText, topDivider: mid(divs[0]), label: mid(t), bottomDivider: mid(divs[1]) };
}));
console.table(rows);
await b.close();
