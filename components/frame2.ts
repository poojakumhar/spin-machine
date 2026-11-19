// Layout of the test machine on "/test2". Art: reference/ref-3-drum.png (clean three-reel drum), used as it is.
// Layers, back to front: drum.png -> live content -> the six ornaments. Rebuild with: python scripts/build_drum3.py
// Content sits in the same places relative to each reel's window as on "/", so labels and animals look the same.
import data from "./faceShapes2.json";
import { makeGeo, span, type Box } from "./frameGeo";

const WIDTH = 1440;
const K = WIDTH / data.width;
const HEIGHT = data.height * K;

// window between the top and bottom ornaments (art px), the same on all three reels of this drum
const top = Math.max(...data.ornaments.filter((q) => q.y < data.height / 3).map((q) => q.y + q.h)) - 6;
const bot = Math.min(...data.ornaments.filter((q) => q.y > data.height / 3).map((q) => q.y)) + 6;
const wy = (f: number) => top + f * (bot - top);
const HALF = 170;                       // half width of a word box (art px), ~0.46 of a reel's width as on "/"

export const GEO2 = makeGeo({
  data, drum: "/frame2/drum.png", version: "4", faces: false,
  box: { left: (1920 - WIDTH) / 2, top: Math.round(459 - HEIGHT / 2), width: WIDTH, height: HEIGHT },
  raw: (_faces, cx): Record<1 | 2 | 3, Box[]> => ({
    1: [{ key: "word", ...span(cx[0], HALF), y0: wy(0.5833), y1: wy(0.9695) }, { key: "scene", ...span(cx[0], HALF * 0.85), y0: wy(0.048), y1: wy(0.607) }],
    // animal area kept at its height from before the drum got taller (457px on screen), bottom edge unchanged
    2: [{ key: "animal", ...span(cx[1], HALF), y0: wy(0.16695), y1: wy(0.95665) }],
    3: [{ key: "word", ...span(cx[2], HALF), y0: wy(0.5833), y1: wy(0.9695) }, { key: "scene", ...span(cx[2], HALF * 0.85), y0: wy(0.048), y1: wy(0.607) }],
  }),
});
