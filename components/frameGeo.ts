// Builds the machine layout (drum image, content boxes, reel windows, ornaments, face outlines) from a drum's
// faceShapes JSON. "/" uses frame.ts (first-version drum); "/test2" uses frame2.ts (the clean three-reel drum).

export type BoxKey = "word" | "scene" | "animal";
export type Box = { key: BoxKey; x0: number; y0: number; x1: number; y1: number };
type Shapes = {
  width: number; height: number;
  faces: { x0: number; y0: number; x1: number; y1: number; cx: number; content_cx?: number; points?: number[][] }[];
  ornaments: { src: string; x: number; y: number; w: number; h: number }[];
};

export type Geo = {
  DRUM: string;
  K: number;
  BOXES: Record<1 | 2 | 3, { key: BoxKey; left: number; top: number; width: number; height: number }[]>;
  ORNAMENTS: { src: string; left: number; top: number; width: number; height: number }[];
  WINDOWS: Record<1 | 2 | 3, Record<BoxKey, number[]>>;
  FACES: { left: number; top: number; width: number; height: number; pts: number[][]; clip: string }[];
  /** Position of the machine on the 1920 x 1080 stage; null keeps the .machine CSS. */
  box: { left: number; top: number; width: number; height: number } | null;
};

export function makeGeo(o: {
  data: Shapes; drum: string; version: string; width?: number;
  raw: (faces: Shapes["faces"], cx: number[]) => Record<1 | 2 | 3, Box[]>;
  faces?: boolean; box?: Geo["box"];
}): Geo {
  const { data } = o;
  const K = (o.width ?? 1440) / data.width;
  const faces = data.faces;
  const cx = faces.map((f) => f.content_cx ?? f.cx);
  const raw = o.raw(faces, cx);
  const BOXES = Object.fromEntries(([1, 2, 3] as const).map((r) => [r,
    raw[r].map((b) => ({ key: b.key, left: b.x0 * K, top: b.y0 * K, width: (b.x1 - b.x0) * K, height: (b.y1 - b.y0) * K }))])) as Geo["BOXES"];
  const ORNAMENTS = data.ornaments.map((q) => ({ src: `${q.src}?v=${o.version}`, left: q.x * K, top: q.y * K, width: q.w * K, height: q.h * K }));
  // visible window of each reel (art px): from just under its top ornament to just over its bottom ornament
  const mid = data.height / 3;
  const inReel = (r: number, q: Shapes["ornaments"][number]) => q.x + q.w / 2 > faces[r].x0 && q.x + q.w / 2 < faces[r].x1;
  const WINDOWS = Object.fromEntries(([1, 2, 3] as const).map((r) => {
    const mine = data.ornaments.filter((q) => inReel(r - 1, q));
    const top = Math.max(...mine.filter((q) => q.y < mid).map((q) => q.y + q.h)) - 6;
    const bot = Math.min(...mine.filter((q) => q.y > mid).map((q) => q.y)) + 6;
    return [r, { word: [top, bot], scene: [top, bot], animal: [Math.min(top, raw[2][0].y0 - 4), bot] }];
  })) as Geo["WINDOWS"];
  const FACES = o.faces === false ? [] : faces.filter((s) => s.points).map((s) => {
    const outline = (s.points as number[][]).map(([x, y]) => [(x - s.x0) * K, (y - s.y0) * K]);
    return {
      left: s.x0 * K, top: s.y0 * K, width: (s.x1 - s.x0) * K, height: (s.y1 - s.y0) * K, pts: outline,
      clip: `polygon(${outline.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`,
    };
  });
  return { DRUM: `${o.drum}?v=${o.version}`, K, BOXES, ORNAMENTS, WINDOWS, FACES, box: o.box ?? null };
}

export const span = (c: number, half: number) => ({ x0: c - half, x1: c + half });

