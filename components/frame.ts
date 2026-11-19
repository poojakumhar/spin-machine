// Layout of the machine on "/". Art: reference/ref-2-drum.png (the first version's drum, 1600 x 900), shown at 1440 wide.
// Layers, back to front: drum.png -> today's reel shading (app/face.css) -> live content in the boxes below
// -> the six ornaments, so the reels turn under them. Rebuild with: python scripts/build_drum2.py
import data from "./faceShapes.json";
import { makeGeo, span, type Box } from "./frameGeo";

// Content height frame per reel (art px), fixed so reshaping a face outline never moves the approved labels or animals.
const CONTENT_Y = [[10, 886], [8, 888], [10, 886]];
const fy = (r: number, f: number) => CONTENT_Y[r][0] + f * (CONTENT_Y[r][1] - CONTENT_Y[r][0]);

export const GEO1 = makeGeo({
  data, drum: "/frame/drum.png", version: "65",
  raw: (_faces, cx): Record<1 | 2 | 3, Box[]> => ({
    1: [{ key: "word", ...span(cx[0], 212), y0: fy(0, 0.5385), y1: fy(0, 0.8308) }, { key: "scene", ...span(cx[0], 180), y0: fy(0, 0.1333), y1: fy(0, 0.5564) }],
    2: [{ key: "animal", ...span(cx[1], 212), y0: fy(1, 0.0841), y1: fy(1, 0.8156) }],
    3: [{ key: "word", ...span(cx[2], 212), y0: fy(2, 0.5385), y1: fy(2, 0.8308) }, { key: "scene", ...span(cx[2], 180), y0: fy(2, 0.1333), y1: fy(2, 0.5564) }],
  }),
});

export const { DRUM, K, BOXES, ORNAMENTS, WINDOWS, FACES } = GEO1;
