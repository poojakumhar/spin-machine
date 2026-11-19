// Measures the kiosk layout against the requested rules. Prints PASS/FAIL lines. API is mocked.
import { chromium } from "playwright";
const items = [
  { id: 1, reel: 1, label: "Tiryanch", image_url: null },
  { id: 2, reel: 1, label: "Placeholder Word A", image_url: null },
  { id: 3, reel: 2, label: "Bullock", image_url: "/reels/bullock.png" },
  { id: 4, reel: 2, label: "Dog", image_url: "/reels/dog.png" },
  { id: 5, reel: 3, label: "Paradhinta", image_url: null },
  { id: 6, reel: 3, label: "Parigrah", image_url: null },
];
const out = [];
const check = (n, ok, d = "") => out.push(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`);
const b = await chromium.launch();
for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const pick = { 1: 0, 2: 0, 3: 0 };
  await p.route("**/api/items", (r) => r.fulfill({ json: { items } }));
  await p.goto(process.env.BASE ?? "http://localhost:3100");
  await p.waitForSelector(".pull span:not(:has-text('…'))");
  await p.waitForTimeout(700);
  const tag = `${w}x${h}`;
  const m = await p.evaluate(() => {
    const front = (sel) => [...document.querySelectorAll(".hole")].map((h) => {
      const cyl = [...h.querySelectorAll(".cyl")].filter((c) => c.style.visibility !== "hidden").sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
      return cyl ? cyl.querySelector(sel) : null;
    }).filter(Boolean);
    const R = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
    const holes = [...document.querySelectorAll(".hole")];
    const words = front(".word");
    const anim = front(".animal")[0], hole2 = document.querySelector(".hole-animal"), name = front(".name")[0];
    const fronts = document.querySelector(".ornament");
    const cs = (el) => getComputedStyle(el);
    // range of the word's own text box (not the padded block)
    const wr = words.map((el) => { const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); return { l: r.left, r: r.right, h: parseFloat(cs(el).fontSize), tt: cs(el).textTransform, text: el.innerText };
    });
    const holeW = holes.filter((x) => x.className.includes("hole-word")).map(R);
    const labelY = [...[...front(".word"), ...front(".name")]].map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); return (r.top + r.bottom) / 2; });
    const pull = R(document.querySelector(".pull")), mach = R(document.querySelector(".machine")), stage = R(document.querySelector(".stage"));
    const order = [...holes, fronts].map((e) => (e.className.includes("frame-front") ? "front" : e.className.includes("hole") ? "hole" : "back"));
    return { labelY, wr, holeW, a: anim && R(anim), hole2: R(hole2), n: name && R(name), nTT: cs(name).textTransform, fz: [...document.querySelectorAll(".word,.name")].map((e) => cs(e).fontSize), pull, mach, stage, zf: cs(fronts).zIndex, zh: holes.map((x) => cs(x).zIndex),
      domFrontLast: [...document.querySelectorAll(".ornament")].every((o) => Number(getComputedStyle(o).zIndex) >= Number(cs(fronts).zIndex)), frontPos: cs(fronts).position };
  });
  check(`${tag} all three labels sit on the same line`, Math.max(...m.labelY) - Math.min(...m.labelY) < 1.5, m.labelY.map((v) => v.toFixed(1)).join(", "));
  const [wL, wR] = m.wr;
  check(`${tag} side-reel words use one letter height`, m.wr.every((x) => x.h === m.wr[0].h), m.wr.map((x) => x.h + "px").join(","));
  check(`${tag} all labels are uppercase`, m.wr.every((x) => x.tt === "uppercase") && m.nTT === "uppercase" && m.wr.every((x) => x.text === x.text.toUpperCase()), m.wr.map((x) => x.text).join(" / "));
  const holeLeft = m.holeW[0], holeRight = m.holeW[1];
  const gap = (wd, hl) => [wd.l - hl[0], hl[2] - wd.r];
  const g1 = gap(wL, holeLeft), g2 = gap(wR, holeRight);
  const sc = m.stage[2] - m.stage[0];
  const k = sc / 1920;
  check(`${tag} equal padding both sides of each word`, Math.abs(g1[0] - g1[1]) < 1.5 && Math.abs(g2[0] - g2[1]) < 1.5, `reel1 ${g1.map((v) => v.toFixed(0))} reel3 ${g2.map((v) => v.toFixed(0))}`);
  check(`${tag} words keep a safe margin from the rings (>= 24 stage px each side)`, Math.min(...g1, ...g2) >= 24 * k, `min ${Math.min(...g1, ...g2).toFixed(0)}px`);
  const inside = (a, hl, pad) => a[0] >= hl[0] + pad && a[2] <= hl[2] - pad && a[1] >= hl[1] && a[3] <= hl[3];
  check(`${tag} animal fully inside its panel with side margin`, inside(m.a, m.hole2, 8 * k), `animal ${m.a.map((v) => v.toFixed(0))} panel ${m.hole2.map((v) => v.toFixed(0))}`);
  check(`${tag} animal name sits in its own band below the animal (no overlap)`, m.n[1] >= m.a[3] - 1, `animal bottom ${m.a[3].toFixed(0)}, name top ${m.n[1].toFixed(0)}`);
  check(`${tag} ornaments are drawn in front of the spinning content`, m.domFrontLast && m.frontPos === "absolute" && Number(m.zf) > Math.max(...m.zh.map(Number)), `front z=${m.zf}, content z=${m.zh}`);
  const lm = m.mach[0] - m.stage[0], rm = m.stage[2] - m.mach[2];
  check(`${tag} machine centred (equal left/right margins)`, Math.abs(lm - rm) < 1.5, `left ${lm.toFixed(1)} right ${rm.toFixed(1)}`);
  const pc = (m.pull[0] + m.pull[2]) / 2, mc = (m.mach[0] + m.mach[2]) / 2;
  check(`${tag} button centred under the machine`, Math.abs(pc - mc) < 1.5, `button ${pc.toFixed(1)} machine ${mc.toFixed(1)}`);
  check(`${tag} button and right ring fully inside the screen`, m.pull[2] <= w && m.pull[0] >= 0 && m.mach[2] <= w && m.mach[0] >= 0 && m.pull[3] <= h);
  await p.close();
}
await b.close();
console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length} pass, ${out.filter((l) => l.startsWith("FAIL")).length} fail`);
