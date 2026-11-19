import { chromium } from "playwright";
const b = await chromium.launch();
for (const [w, h] of [[1280, 800], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  let spins = 0; p.on("request", (r) => r.url().includes("/api/spin") && spins++);
  await p.goto("http://localhost:3100/test"); await p.waitForSelector(".t-spin-btn:not([disabled])"); await p.waitForTimeout(600);
  await p.screenshot({ path: `shots/test-${w}-idle.png` });
  await p.click(".t-spin-btn"); await p.waitForTimeout(1500); await p.screenshot({ path: `shots/test-${w}-spin.png` });
  await p.waitForSelector(".t-spin-btn:not([disabled])", { timeout: 15000 }); await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/test-${w}-result.png` });
  console.log(w, "result:", await p.locator(".t-result").innerText(), "| spin calls:", spins, "| errors:", errs.join(" ; ") || "none");
  await p.close();
}
await b.close();
