"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GEO1 } from "./frame";
import type { Geo } from "./frameGeo";
import { GeoContext } from "./geoContext";
import { Reel, type Cell, type ReelHandle } from "./Reel";
import { sfx } from "./sound";
import { demoItems, demoSpin } from "./demo";

type Phase = "loading" | "idle" | "spinning" | "result" | "error";
type SpinRes = { spinId: number; result: Cell[]; decoys: Cell[][] };

const W = 1920, H = 1080;
const STOP_MS = [1800, 2150, 2500];  // a 2.5-second spin; reels stop left to right (spin sound loops until then)
const RESULT_MS = 9000;      // result stays this long, then back to idle
const LOCK_MS = 2500;        // presses ignored this long after the result lands
const COOLDOWN_MS = 700;     // min gap between accepted presses
const ATTRACT_AFTER = 20000; // no input -> attract mode
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Machine({ geo = GEO1 }: { geo?: Geo } = {}) {
  const { DRUM, FACES, ORNAMENTS } = geo;
  const [scale, setScale] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [attract, setAttract] = useState(false);
  const [sound, setSound] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [initial, setInitial] = useState<(Cell | null)[]>([null, null, null]);
  const [pools, setPools] = useState<Cell[][]>([[], [], []]);
  const [reduced, setReduced] = useState(false);

  const reels = [useRef<ReelHandle>(null), useRef<ReelHandle>(null), useRef<ReelHandle>(null)];
  const items = useRef<Cell[][]>([[], [], []]);
  const phaseRef = useRef<Phase>("loading");
  const lastInput = useRef(Date.now());
  const lastPress = useRef(0);
  const resultAt = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const soundRef = useRef(false);
  const attractIdx = useRef(0);
  const demo = useRef(typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo"));

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  useEffect(() => { soundRef.current = sound; if (sound) sfx.preload(); else sfx.end(); }, [sound]);

  // Fit the fixed 1920x1080 stage to the window (letterboxed).
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Load items, preload every image before the first spin.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    (async () => {
      try {
        let all: (Cell & { reel: number })[];
        if (demo.current) all = demoItems();
        else {
          const r = await fetch("/api/items", { cache: "no-store" });
          if (!r.ok) throw new Error();
          all = ((await r.json()) as { items: (Cell & { reel: number })[] }).items;
        }
        const byReel = [1, 2, 3].map((n) => all.filter((i) => i.reel === n));
        if (byReel.some((l) => !l.length)) throw new Error();
        items.current = byReel;
        await Promise.all(
          all.filter((i) => i.image_url).map(
            (i) => new Promise<void>((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = i.image_url!; if (im.decode) im.decode().then(res, res); }),
          ),
        );
        await document.fonts?.ready;
        setPools(byReel);
        setInitial(byReel.map((l) => l[0]));
        setP("idle");
      } catch {
        setP("error");
      }
    })();
  }, []);

  const press = useCallback(async () => {
    if (soundRef.current) sfx.unlock();    // still inside the tap: lets phones play the spin sound that follows
    const now = Date.now();
    lastInput.current = now;
    const p = phaseRef.current;
    if (p === "loading" || p === "spinning") return;
    if (p === "result" && now - resultAt.current < LOCK_MS) return;
    if (now - lastPress.current < COOLDOWN_MS) return;
    lastPress.current = now;
    clearTimeout(resetTimer.current);
    setAttract(false);
    setConfetti(0);
    setP("spinning");
    let res: SpinRes;
    try {
      if (demo.current) res = demoSpin();
      else {
        const r = await fetch("/api/spin", { method: "POST" });
        if (!r.ok) throw new Error();
        res = await r.json();
      }
    } catch {
      setP("error");
      setTimeout(() => phaseRef.current === "error" && setP("idle"), 3000);
      return;
    }
    if (soundRef.current) sfx.start();
    await Promise.all(
      reels.map(async (r, i) => {
        await r.current?.spin(res.decoys[i], res.result[i], reduced ? 0 : STOP_MS[i]);
        if (reduced) await sleep(i * 350);
      }),
    );
    resultAt.current = Date.now();
    setP("result");
    setConfetti(res.spinId);
    if (soundRef.current) { sfx.end(); sfx.win(); }   // spin loop stops when the result shows
    resetTimer.current = setTimeout(() => { setConfetti(0); setP("idle"); lastInput.current = Date.now(); }, RESULT_MS);
  }, [reduced]);

  // Input: Space/Enter (also arcade/USB buttons), F = fullscreen, pointer activity.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      lastInput.current = Date.now();
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        if (!e.repeat) void press();
      } else if (e.code === "KeyF") {
        if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.();
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space" || e.code === "Enter") e.preventDefault(); };
    let hide: ReturnType<typeof setTimeout>;
    const move = () => {
      lastInput.current = Date.now();
      setCursorHidden(false);
      clearTimeout(hide);
      hide = setTimeout(() => setCursorHidden(true), 2500);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    hide = setTimeout(() => setCursorHidden(true), 2500);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", move);
      clearTimeout(hide);
    };
  }, [press]);

  // Attract mode: after 20s idle, gently roll each reel to the next item every few seconds.
  useEffect(() => {
    const t = setInterval(() => {
      const idle = phaseRef.current === "idle" && Date.now() - lastInput.current > ATTRACT_AFTER;
      setAttract(idle);
      if (!idle || reduced) return;
      attractIdx.current++;
      reels.forEach((r, i) => {
        const l = items.current[i];
        if (l.length) setTimeout(() => phaseRef.current === "idle" && r.current?.spin([], l[attractIdx.current % l.length], 900), i * 180);
      });
    }, 3600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const label = phase === "spinning" ? "SPINNING" : phase === "result" ? "PULL AGAIN" : phase === "error" ? "TRY AGAIN" : attract ? "PRESS TO BEGIN" : "PULL";
  const glow = phase === "result";

  return (
    <div className="viewport">
      <div
        className={`stage${cursorHidden ? " nocursor" : ""}${reduced ? " reduced" : ""}`}
        style={{ transform: `translate(-50%,-50%) scale(${scale || 1})`, opacity: scale ? 1 : 0 }}
        onDoubleClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}
      >
        <GeoContext.Provider value={geo}>
        <div className={`machine${glow ? " win" : ""}`} style={geo.box ?? undefined}>
          {/* the whole first-version drum: rings, rolled parchment and ornaments, with smooth shading (scripts/build_drum2.py) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="frame drum" src={DRUM} alt="" draggable={false} />
          {/* today's reel shading (app/face.css), the same on all three reels, clipped to each reel between its rings */}
          {FACES.map((f, i) => (
            <div key={i} className="face-wrap" aria-hidden style={{ left: f.left, top: f.top, width: f.width, height: f.height }}>
              <div className="face" style={{ clipPath: f.clip }} />
            </div>
          ))}
          {([1, 2, 3] as const).map((n, i) => (
            <Reel key={n} ref={reels[i]} reel={n} initial={initial[i]} reduced={reduced} pool={pools[i]} />
          ))}
          {ORNAMENTS.map((o, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} className="ornament" src={o.src} alt="" draggable={false} style={{ left: o.left, top: o.top, width: o.width, height: o.height }} />
          ))}
        </div>
        </GeoContext.Provider>

        <button className={`pull${phase === "spinning" ? " busy" : ""}`} tabIndex={-1} onClick={() => void press()} onMouseUp={(e) => e.currentTarget.blur()}>
          <span>{phase === "loading" ? "…" : label}</span>
        </button>

        <button className="sound" tabIndex={-1} aria-label="Toggle sound" onClick={(e) => { if (!soundRef.current) sfx.unlock(); setSound((s) => !s); e.currentTarget.blur(); }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8a0f1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#8a0f1c" />
            {sound ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16 9l5 6M21 9l-5 6" />}
          </svg>
        </button>

        {confetti > 0 && (
          <div className="confetti" key={confetti} aria-hidden>
            {Array.from({ length: 30 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 97) % 100}%`, animationDelay: `${(i % 11) * 0.09}s`, animationDuration: `${3.2 + (i % 5) * 0.5}s`, background: i % 3 ? "#e8b02e" : i % 3 === 0 && i % 2 ? "#b3202c" : "#fff1b0", transform: `rotate(${i * 37}deg)` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
