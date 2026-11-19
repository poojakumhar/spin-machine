"use client";
// /test: port of Downloads/slot-machine.html. Same geometry, cylinder projection, timing and sound.
// Difference from the HTML: reel contents come from /api/items and the result from /api/spin (the same backend as /),
// so the server picks the result and records the spin. ?demo=1 uses offline data like the kiosk.
import { useEffect, useRef, useState } from "react";
import { demoItems, demoSpin } from "./demo";

type Sym = { id: number; word: string; icon: string | null };
type Reel = { col: HTMLDivElement; segs: HTMLDivElement[]; symbols: Sym[]; n: number; segAngle: number; angle: number };

const WINDOW = { left: 0.0716, right: 0.109, top: 0.1192, bottom: 0.1916 };
const BLEED = 0.012;
const CORNER = 0.17;
const VISIBLE_THETA = Math.PI * 0.58;
const INSET = 0.9;
const SPIN_TIME_SCALE = 1.25;
const CHAR_EM = 0.6;
const TAU = 2 * Math.PI;

function fitReelText(len: number, boxW: number, boxH: number) {
  const cap = Math.min(boxW * 0.6, boxH * 0.6);
  const one = (boxW * 0.98) / (len * CHAR_EM);
  if (one >= cap) return cap;
  const two = Math.min((boxW * 0.98) / (Math.ceil(len / 2) * CHAR_EM), (boxH * 0.9) / (2 * 1.18));
  return Math.max(8, Math.min(Math.max(one, two), cap));
}

function render(r: Reel) {
  const H = r.col.clientHeight, W = r.col.clientWidth;
  const radius = H * 0.62, cy = H / 2;
  for (let i = 0; i < r.n; i++) {
    let theta = i * r.segAngle - r.angle;
    theta -= Math.round(theta / TAU) * TAU;
    const abs = Math.abs(theta), cos = Math.cos(theta), sliceH = H * cos;
    const el = r.segs[i];
    if (abs >= VISIBLE_THETA || sliceH < 1) { el.style.opacity = "0"; continue; }
    const top = cy + radius * Math.sin(theta) - sliceH / 2;
    const insetH = sliceH * (1 - INSET), insetW = W * (1 - INSET);
    el.style.top = top + insetH / 2 + "px";
    el.style.height = sliceH - insetH + "px";
    el.style.left = insetW / 2 + "px";
    el.style.right = insetW / 2 + "px";
    el.style.opacity = String(cos);
    el.style.zIndex = String(Math.round((Math.PI - abs) * 100));
  }
}

function spinReel(r: Reel, ri: number, target: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const loops = 3 + Math.floor(Math.random() * 2);
      const cur = ((r.angle % TAU) + TAU) % TAU;
      let diff = ((target * r.segAngle) % TAU) - cur;
      if (diff < 0) diff += TAU;
      const from = r.angle, to = from + loops * TAU + diff;
      const duration = (1800 + ri * 260) * SPIN_TIME_SCALE;
      let start: number | null = null;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const t = Math.min((ts - start) / duration, 1);
        r.angle = from + (to - from) * (1 - (1 - t) ** 3);
        render(r);
        if (t < 1) requestAnimationFrame(step);
        else { r.angle = target * r.segAngle; render(r); resolve(); }
      };
      requestAnimationFrame(step);
    }, ri * 130 * SPIN_TIME_SCALE);
  });
}

export default function TestSlot() {
  const cabinet = useRef<HTMLDivElement>(null);
  const reelsEl = useRef<HTMLDivElement>(null);
  const reels = useRef<Reel[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const demo = useRef(false);
  const [busy, setBusy] = useState(true);
  const [result, setResult] = useState("");

  useEffect(() => {
    demo.current = new URLSearchParams(window.location.search).has("demo");
    audio.current = new Audio("/test/spin.m4a");
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    (async () => {
      let items: { id: number; reel: number; label: string; image_url: string | null }[];
      try {
        if (demo.current) items = demoItems();
        else {
          const r = await fetch("/api/items", { cache: "no-store" });
          if (!r.ok) throw new Error();
          items = (await r.json()).items;
        }
      } catch {
        if (!cancelled) setResult("Could not load the reels. Check the server and refresh.");
        return;
      }
      if (cancelled || !reelsEl.current || !cabinet.current) return;
      const box = reelsEl.current;
      Object.assign(box.style, {
        left: (WINDOW.left - BLEED) * 100 + "%", right: (WINDOW.right - BLEED) * 100 + "%",
        top: (WINDOW.top - BLEED) * 100 + "%", bottom: (WINDOW.bottom - BLEED) * 100 + "%",
      });
      box.innerHTML = "";
      const REELS: Sym[][] = [1, 2, 3].map((n) =>
        items.filter((i) => i.reel === n).map((i) => ({ id: i.id, word: i.label, icon: i.image_url })));
      reels.current = REELS.map((symbols, ri) => {
        const col = document.createElement("div");
        col.className = "t-reel";
        const segs = symbols.map((s) => {
          const d = document.createElement("div");
          d.className = "t-seg";
          if (s.icon) { const img = document.createElement("img"); img.src = s.icon; img.alt = s.word; d.appendChild(img); }
          else { const w = document.createElement("div"); w.className = "t-word"; w.textContent = s.word; d.appendChild(w); }
          col.appendChild(d);
          return d;
        });
        const side = document.createElement("div"); side.className = "t-side"; col.appendChild(side);
        box.appendChild(col);
        const n = Math.max(symbols.length, 1);
        return { col, segs, symbols, n, segAngle: TAU / n, angle: (ri % n) * (TAU / n) };
      });
      ["t-shade-v", "t-gloss"].forEach((c) => { const d = document.createElement("div"); d.className = c; box.appendChild(d); });
      for (let i = 1; i < REELS.length; i++) {
        const d = document.createElement("div"); d.className = "t-divider";
        d.style.left = `calc(100% * ${i / REELS.length} - 2px)`;
        box.appendChild(d);
      }
      const maxLen = Math.max(1, ...REELS.flat().map((e) => e.word.length));
      const layout = () => {
        const H = box.clientHeight;
        box.style.borderRadius = H * CORNER + "px";
        const r0 = reels.current[0];
        if (r0) {
          const boxW = r0.col.clientWidth * INSET;
          let fs = fitReelText(maxLen, boxW, H * INSET);
          const words = [...box.querySelectorAll<HTMLElement>(".t-seg .t-word")];
          const probe = document.createElement("span");
          probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-weight:700;font-family:inherit";
          probe.style.fontSize = fs + "px";
          box.appendChild(probe);
          let widest = 0;
          words.forEach((w) => { probe.textContent = w.textContent; widest = Math.max(widest, probe.offsetWidth); });
          probe.remove();
          if (widest > boxW * 0.96) fs = Math.max(8, (fs * boxW * 0.96) / widest);
          words.forEach((w) => { w.style.fontSize = fs + "px"; });
        }
        reels.current.forEach(render);
      };
      ro = new ResizeObserver(layout);
      ro.observe(cabinet.current);
      layout();
      document.fonts?.ready.then(layout);
      setBusy(false);
    })();
    return () => { cancelled = true; ro?.disconnect(); };
  }, []);

  async function spin() {
    if (busy) return;
    setBusy(true);
    setResult("");
    const a = audio.current;
    if (a) { try { a.currentTime = 0; void a.play(); } catch { /* autoplay blocked */ } }
    let res: { result: { id: number; label: string }[] };
    try {
      if (demo.current) res = demoSpin();
      else {
        const r = await fetch("/api/spin", { method: "POST" });
        if (!r.ok) throw new Error();
        res = await r.json();
      }
    } catch {
      a?.pause();
      setResult("Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    await Promise.all(reels.current.map((r, ri) => {
      const t = Math.max(0, r.symbols.findIndex((s) => s.id === res.result[ri].id));
      return spinReel(r, ri, t);
    }));
    a?.pause();
    setBusy(false);
    setResult(res.result.map((x) => x.label).join(" · "));
  }

  return (
    <div className="tsm">
      <div className="t-tagline">✦ Spin to discover your focus ✦</div>
      <div className="t-cabinet" ref={cabinet}>
        <div className="t-reels" ref={reelsEl} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="t-frame" src="/test/frame.png" alt="" />
      </div>
      <button className="t-spin-btn" type="button" onClick={() => void spin()} disabled={busy}>
        <span className="t-face">
          {busy && reels.current.length ? <span>Spinning…</span> : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/test/icon-left.png" alt="" /><span>Spin</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/test/icon-right.png" alt="" />
            </>
          )}
        </span>
      </button>
      <div className="t-result" aria-live="polite">{result}</div>
    </div>
  );
}
