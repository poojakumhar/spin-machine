"use client";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useGeo } from "./geoContext";
import { Divider } from "./Divider";

export type Cell = { id: number; label: string; image_url: string | null };
export type ReelHandle = { spin: (decoys: Cell[], target: Cell, ms: number) => Promise<void>; show: (c: Cell) => void };


/** One-line label: 46px, shrunk only when a long label would not fit (never wraps, never touches the rings). */
function Label({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(46);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => { document.fonts?.ready.then(() => setFontsReady(true)); }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;
    const ps = getComputedStyle(el.parentElement);
    const room = el.parentElement.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight);
    const cur = parseFloat(getComputedStyle(el).fontSize);
    const natural = (el.scrollWidth / cur) * 46;          // width the label would have at 46px
    setSize(natural > room ? Math.max(24, Math.floor((46 * room) / natural)) : 46);
  }, [text, fontsReady]);
  return <div ref={ref} className={className} style={{ fontSize: size }}>{text}</div>;
}

function BoxCell({ kind, cell, h }: { kind: "word" | "scene" | "animal"; cell: Cell; h: number }) {
  if (kind === "word") {
    return (
      <div className="hcell" style={{ height: h }}>
        <div className="wblock">
          <Divider />
          <Label text={cell.label} className="word" />
          <Divider flip />
        </div>
      </div>
    );
  }
  if (kind === "scene") {
    return (
      <div className="hcell" style={{ height: h }}>
        {cell.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img className="scene" src={cell.image_url} alt="" draggable={false} />}
      </div>
    );
  }
  return (
    <div className="hcell acell" style={{ height: h }}>
      <div className="aimg">
        {cell.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img className="animal" src={cell.image_url} alt="" draggable={false} />}
      </div>
      <div className="nameblock">
        <Divider />
        <Label text={cell.label} className="name" />
        <Divider flip />
      </div>
    </div>
  );
}

// Cylinder: every item sits at an angle on the drum. theta = index * SEG - angle; the item is drawn at
// front + R * sin(theta), squashed by cos(theta) and faded toward the rim, like /test.
const SEG = Math.PI / 4;                 // angle between neighbouring items
const VISIBLE = Math.PI / 2 - 0.05;      // beyond this an item is behind the drum
const ease = (t: number) => { const c1 = 0.15, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };  // ease-out, small settle

export const Reel = forwardRef<ReelHandle, { reel: 1 | 2 | 3; initial: Cell | null; reduced: boolean; pool?: Cell[] }>(function Reel({ reel, initial, reduced, pool = [] }, ref) {
  const { BOXES, WINDOWS, K } = useGeo();
  const boxes = BOXES[reel];
  const WIN = WINDOWS[reel];   // art px: the visible window runs between the top and bottom ornaments
  const [cells, setCells] = useState<Cell[]>([]);
  const holes = useRef<(HTMLDivElement | null)[]>([]);
  const angle = useRef(0);
  const raf = useRef(0);
  const shown = useRef<Cell | null>(null);
  const spinToken = useRef(0);   // cancels a pending end-of-spin tidy-up when a new spin starts
  const resting = useRef(true);   // at rest only the front item shows; neighbours appear only while the reel turns
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const draw = (instant = false) => {
    boxes.forEach((b, bi) => {
      const hole = holes.current[bi];
      if (!hole) return;
      const top = WIN[b.key][0] * K;
      const front = b.top - top + b.height / 2;          // where the front item's centre sits inside the window
      // animals are tall: a larger radius keeps the neighbours out at the rim instead of on top of the front animal
      const R = b.height * (b.key === "animal" ? 1.5 : 1.35);
      [...hole.children].forEach((el, j) => {
        const e = el as HTMLElement;
        const theta = j * SEG - angle.current;
        if (Math.abs(theta) >= VISIBLE) { e.style.visibility = "hidden"; return; }
        const c = Math.cos(theta);
        e.style.visibility = "visible";
        e.style.transform = `translateY(${front - b.height / 2 + R * Math.sin(theta)}px) scaleY(${c})`;
        // neighbours fade well below the front item, so the front one clearly reads as the result;
        // when the reel stops they fade out completely: one word per reel
        const hide = resting.current && Math.abs(theta) > 0.01;
        // fade only when the reel has just stopped; swapping to the resting list is instant (no blink)
        e.style.transition = resting.current && !instant ? "opacity .35s ease-out" : "";
        e.style.opacity = hide ? "0" : String(Math.pow(Math.max(0, (c - 0.55) / 0.45), 1.5));
        e.style.zIndex = String(Math.round(c * 100));
      });
    });
  };

  // neighbours around an item, taken from the reel's real list, so idle reels show what's above and below
  const around = (c: Cell): Cell[] => {
    const p = poolRef.current;
    const i = p.findIndex((x) => x.id === c.id);
    if (p.length < 2 || i < 0) return [c, c, c].map((x, k) => (k === 1 ? x : { ...x, id: -1 - k }));
    return [p[(i - 1 + p.length) % p.length], c, p[(i + 1) % p.length]];
  };

  const settle = (c: Cell) => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    shown.current = c;
    resting.current = true;
    flushSync(() => setCells(around(c)));
    angle.current = SEG;
    draw(true);
  };

  useEffect(() => { if (initial && !shown.current) settle(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { draw(true); });   // re-renders never fade anything

  useImperativeHandle(ref, () => ({
    show: settle,
    async spin(decoys, target, ms) {
      const from = shown.current;
      if (reduced || !from) { settle(target); return; }
      cancelAnimationFrame(raf.current);
      spinToken.current++;
      const before = around(from), after = around(target);
      // A real drum shows its items in a fixed order: turn through the reel's own list, at least 12 steps, ending on the result.
      const p = poolRef.current;
      const fi = p.findIndex((x) => x.id === from.id), ti = p.findIndex((x) => x.id === target.id);
      let list: Cell[];
      if (p.length >= 2 && fi >= 0 && ti >= 0) {
        let steps = (ti - fi + p.length) % p.length;
        while (steps < 12) steps += p.length;
        list = [before[0], ...Array.from({ length: steps + 1 }, (_, k) => p[(fi + k) % p.length]), after[2]];
      } else {
        const filler = decoys.length ? Array.from({ length: 12 }, (_, i) => decoys[i % decoys.length]) : [];
        list = [before[0], from, ...filler, target, after[2]];
      }
      shown.current = target;
      resting.current = false;
      flushSync(() => setCells(list));
      const start = SEG, end = (list.length - 2) * SEG;
      angle.current = start;
      draw();
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / ms);
          angle.current = start + (end - start) * ease(t);
          draw();
          if (t < 1) raf.current = requestAnimationFrame(step);
          else resolve();
        };
        raf.current = requestAnimationFrame(step);
      });
      if (shown.current !== target) return;
      // The reel has stopped: report it now (the stop sound and result use this moment), then fade the
      // neighbours out and swap to the short resting list in the background. A newer spin cancels the swap.
      const token = ++spinToken.current;
      resting.current = true;
      draw();
      setTimeout(() => { if (spinToken.current === token) settle(target); }, 360);
    },
  }));

  return (
    <>
      {boxes.map((b, i) => (
        <div key={b.key} className={`hole hole-${b.key}`} ref={(el) => { holes.current[i] = el; }} style={{ left: b.left, top: WIN[b.key][0] * K, width: b.width, height: (WIN[b.key][1] - WIN[b.key][0]) * K }}>
          {cells.map((c, j) => (
            <div key={j} className="cyl" style={{ height: b.height }}>
              <BoxCell kind={b.key} cell={c} h={b.height} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
});
