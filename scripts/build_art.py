"""Builds the machine art from reference/ref-clean.png (the user's improved render).
  public/frame/frame-front.png   gold rings + ornaments only (transparent everywhere else)
  components/faceShapes.json     outline of each reel face (between its two rings), pushed 6px under the rings
Run: python scripts/build_art.py
"""
import json
import cv2
import numpy as np
from scipy.ndimage import median_filter, gaussian_filter1d

im = cv2.imread("reference/ref-clean.png", cv2.IMREAD_COLOR)

# The outer rings are broken near the top in the source (offset top cap, notches). Their lower half is clean, so rebuild the
# upper half of each outer ring as a vertical mirror of its lower half. Ornament areas are left alone.
def _mirror_outer(img):
    hsv0 = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gold0 = (hsv0[..., 1] > 209) & (hsv0[..., 2] > 90)
    Hh, Ww = img.shape[:2]
    out = img.copy()
    for x0, x1, orn in ((0, 150, (108, 999)), (Ww - 150, Ww, (0, Ww - 108))):
        rows = np.where(gold0[:, x0:x1].sum(1) > 6)[0]
        y_top, y_bot = int(rows.min()), int(rows.max())
        mid = (y_top + y_bot) / 2.0
        for y in range(0, int(mid)):
            sy = int(round(2 * mid - y))
            if sy >= Hh:
                continue
            for x in range(x0, x1):
                if 20 <= y <= 118 and orn[0] <= x <= orn[1]:
                    continue                      # ornament box
                out[y, x] = img[sy, x]
    return out
im = _mirror_outer(im)
H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
sat = hsv[..., 1].astype(np.float32) / 255.0
val = hsv[..., 2]
hue = hsv[..., 0].astype(np.float32) * 2

# gold, orange-brown and ruby pixels: saturated
g = ((sat > 0.82) & (val > 90)).astype(np.uint8)
g = cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))

def fill_small_holes(m, max_area):
    cnts, hier = cv2.findContours(m.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = m.astype(np.uint8).copy()
    if hier is not None:
        for c, h in zip(cnts, hier[0]):
            if h[3] != -1 and cv2.contourArea(c) <= max_area:
                cv2.drawContours(out, [c], -1, 1, -1)
    return out

g = fill_small_holes(g, 6000)         # pale highlight strips and gem glints are enclosed by gold
# Split the rings: erode (the rings are thick, everything joining them is thin), label, then grow each piece back inside the gold.
er = cv2.erode(g, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
ne, le, se, ce = cv2.connectedComponentsWithStats(er, connectivity=8)
cand = sorted([(ce[i][0], i) for i in range(1, ne) if se[i, cv2.CC_STAT_HEIGHT] > 0.55 * H])
print("ring cores:", [(int(c), int(se[i, 4])) for c, i in cand])
assert len(cand) == 4, "expected 4 ring cores"
ring_masks, keep = [], np.zeros((H, W), np.uint8)
ring_union = np.zeros((H, W), np.uint8)
for _, i in cand:
    core = (le == i).astype(np.uint8)
    grown = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))) & g
    # keep only the part of the grown region connected to the core
    nn, ll = cv2.connectedComponents(grown)
    lab_core = np.bincount(ll[core > 0]).argmax()
    m = (ll == lab_core).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
    m = fill_small_holes(m, 4000)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27)))
    m = m.astype(bool)
    ring_masks.append(m); ring_union |= m.astype(np.uint8)
# Rebuild every ring from a smooth outline: per-row left/right extents (median + gaussian), rounded ends, notches filled from the
# neighbouring gold. This removes ragged ends, feet and bites in one go.
ring_fill = np.zeros((H, W), np.uint8)
env_masks = []
for m in ring_masks:
    rows_ = np.where(m.any(1))[0]
    y_a, y_b = int(rows_.min()), int(rows_.max())
    lo = np.full(H, np.nan); hi = np.full(H, np.nan)
    for y in range(y_a, y_b + 1):
        xs = np.where(m[y])[0]
        if len(xs):
            lo[y], hi[y] = xs.min(), xs.max()
    ok_ = ~np.isnan(lo); yy_ = np.arange(H)
    lo = np.interp(yy_, yy_[ok_], lo[ok_]); hi = np.interp(yy_, yy_[ok_], hi[ok_])
    lo = gaussian_filter1d(median_filter(lo, 61, mode="nearest"), 5); hi = gaussian_filter1d(median_filter(hi, 61, mode="nearest"), 5)
    if 0 < len(env_masks) < 3 and len(ring_masks) == 4:          # the two dividers (2nd and 3rd ring)
        mid = np.arange(y_a + 150, y_b - 220)
        pc = np.polyfit(mid, (lo[mid] + hi[mid]) / 2, 2)
        wmed = float(np.median((hi - lo)[mid]))
        for y in range(y_b - 220, y_b + 1):                 # hold the ring to its own width: the darker rear side can't widen it
            c_ = np.polyval(pc, y)
            lo[y] = max(lo[y], c_ - wmed / 2); hi[y] = min(hi[y], c_ + wmed / 2)
    env = np.zeros((H, W), np.uint8)
    for y in range(y_a, y_b + 1):
        end = min(y - y_a, y_b - y)
        if end < 16:                                   # round the two ends
            r = (16 - end) / 16.0
            shrink = (1 - np.sqrt(max(0.0, 1 - r * r))) * (hi[y] - lo[y]) * 0.5
        else:
            shrink = 0.0
        env[y, int(round(lo[y] + shrink)):int(round(hi[y] - shrink)) + 1] = 1
    env_masks.append(env.astype(bool))
    ring_fill |= (env & ~m.astype(np.uint8)).astype(np.uint8)   # pixels the envelope adds: notches and slots
if ring_fill.any():
    im = cv2.inpaint(im, cv2.dilate(ring_fill, np.ones((3, 3), np.uint8)) * 255, 6, cv2.INPAINT_TELEA)
ring_masks = env_masks
ring_union = np.zeros((H, W), np.uint8)
for m in ring_masks:
    ring_union |= m.astype(np.uint8)
keep |= ring_union
g_orn = g.copy()
g_orn[786:] = 0          # the old bottom rim strip lives below; the ornaments end above y 786
n, lab, st, cen = cv2.connectedComponentsWithStats(g_orn & (1 - ring_union), connectivity=8)
near_ring = cv2.dilate(ring_union, np.ones((11, 11), np.uint8)).astype(bool)
# ornaments: components in the top / bottom bands (the words, dividers and bull live between them)
TOP, BOT = 125, H - 165
for i in range(1, n):
    x, y, w, h, a = st[i]
    cy = cen[i][1]
    if a > 150 and h > 35 and w < 400 and (cy < TOP or cy > BOT):
        comp = (lab == i)
        if (comp & near_ring).sum() > 0.3 * a:
            continue                      # leftover of a ring's old foot, not an ornament
        pass                              # ornaments now come from scripts/build_ornaments.py (first-version style)

# pale cream left on the outside of the rings (from the old background) is not gold: drop it near the outline
hsv2 = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
s2, v2 = hsv2[..., 1].astype(np.float32) / 255.0, hsv2[..., 2]
dd = cv2.distanceTransform(keep, cv2.DIST_L2, 3)
outer_side = np.zeros((H, W), bool)
outer_side[:, :10] = True; outer_side[:, W - 10:] = True          # only the outside edge of the two outer rings
# the ring body itself is always solid (its pale highlight stripe must not be trimmed); only the outermost 5 columns may lose cream
keep[:, 5:W - 5] |= ring_union[:, 5:W - 5]
# Outer edge of the two outer rings: fit a smooth curve to where the saturated gold starts, cut outside it, solid inside it.
for idx, side in ((0, "left"), (len(ring_masks) - 1, "right")):
    env = ring_masks[idx]
    rows = np.where(env.any(1))[0]
    ys, xs = [], []
    for y in rows:
        cols_ = np.where(env[y])[0]
        if side == "left":
            seg = np.where(s2[y, :cols_.max()] > 0.80)[0]
            if len(seg): ys.append(y); xs.append(seg.min())
        else:
            seg = np.where(s2[y, cols_.min():] > 0.80)[0]
            if len(seg): ys.append(y); xs.append(cols_.min() + seg.max())
    ys, xs = np.array(ys, float), np.array(xs, float)
    core = (ys > rows.min() + 40) & (ys < rows.max() - 40)
    fit = np.polyfit(ys[core], median_filter(xs, 31, mode="nearest")[core], 4)
    for y in rows:
        cols_ = np.where(env[y])[0]
        xo = float(np.polyval(fit, y))
        if side == "left":
            xo = max(xo, float(cols_.min()))
            keep[y, :int(np.floor(xo))] = 0
            keep[y, int(np.ceil(xo)):cols_.max() + 1] |= 1
        else:
            xo = min(xo, float(cols_.max()))
            keep[y, int(np.ceil(xo)) + 1:] = 0
            keep[y, cols_.min():int(np.floor(xo)) + 1] |= 1
keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
# Clean the bottom: tiny detached specks below the ornaments are residue of the old strip (rings are untouched).
cn, cl, cs, _ = cv2.connectedComponentsWithStats(keep, connectivity=8)
for i in range(1, cn):
    x, y, w, h, ar = cs[i]
    if y > 780 and ar < 1500 and w < 260:
        keep[cl == i] = 0
alpha = cv2.GaussianBlur(cv2.dilate(keep, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 0.7)
front = np.dstack([im, np.clip(alpha * 255, 0, 255).astype(np.uint8)])
cv2.imwrite("public/frame/frame-front.png", front)

# face outlines
shapes = []
UNDER = 10
for d in range(3):
    left, right = ring_masks[d], ring_masks[d + 1]
    A = np.full(H, np.nan); B = np.full(H, np.nan)
    for y in range(H):
        xl, xr = np.where(left[y])[0], np.where(right[y])[0]
        if len(xl) and len(xr):
            A[y] = xl.max(); B[y] = xr.min()
    ok = (~np.isnan(A)) & ((B - A) > 150)
    ys = np.where(ok)[0]
    y0, y1 = 26, 806        # same top and bottom for all three faces
    yy = np.arange(H)
    A = np.interp(yy, yy[ok], A[ok]); B = np.interp(yy, yy[ok], B[ok])
    A = gaussian_filter1d(median_filter(A, 21, mode="nearest"), 3) - UNDER
    B = gaussian_filter1d(median_filter(B, 21, mode="nearest"), 3) + UNDER
    rows = list(range(y0, y1 + 1, 6)) + [y1]
    pts = [(float(A[y]), float(y)) for y in rows] + [(float(B[y]), float(y)) for y in reversed(rows)]
    xs = [p[0] for p in pts]
    shapes.append(dict(x0=round(min(xs), 1), y0=float(y0), x1=round(max(xs), 1), y1=float(y1), cx=round(float((A[y0:y1].mean() + B[y0:y1].mean()) / 2), 1),
                       points=[[round(x, 1), round(y, 1)] for x, y in pts]))
    print(f"drum {d + 1}: x {min(xs):.0f}..{max(xs):.0f}  y {y0}..{y1}  centre {shapes[-1]['cx']}")
# content centres = the ruby gems of the top and bottom ornaments (exact, unlike the ornament outlines)
hsv_g = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
ruby = (((hsv_g[..., 0] < 8) | (hsv_g[..., 0] > 168)) & (hsv_g[..., 1] > 140) & (hsv_g[..., 2] > 80)).astype(np.uint8)
def gem_centres(y0_, y1_):
    rn, rl, rs, rc = cv2.connectedComponentsWithStats(ruby[y0_:y1_])
    return sorted((float(rc[i][0]), float(rc[i][1]) + y0_) for i in range(1, rn) if rs[i, 4] > 150)
gt, gb = gem_centres(20, 110), gem_centres(690, 800)
print("gem centres top", gt, "bottom", gb)
if len(gt) == 3 and len(gb) == 3:
    for k in range(3):
        shapes[k]["content_cx"] = round((gt[k][0] + gb[k][0]) / 2, 1)
        shapes[k]["gem_top"] = [round(gt[k][0], 1), round(gt[k][1], 1)]
        shapes[k]["gem_bot"] = [round(gb[k][0], 1), round(gb[k][1], 1)]
    print("content centres (gems):", [s_["content_cx"] for s_ in shapes])
json.dump(dict(width=W, height=H, faces=shapes), open("components/faceShapes.json", "w"), indent=1)
# average face colours for the CSS faces
for d, s in enumerate(shapes):
    cx, cy = int(s["cx"]), int((s["y0"] + s["y1"]) / 2)
    c = im[cy - 15:cy + 15, cx - 15:cx + 15].reshape(-1, 3).mean(0)[::-1]
    e = im[cy - 15:cy + 15, int(s["x0"]) + 30:int(s["x0"]) + 45].reshape(-1, 3).mean(0)[::-1]
    print(f"face {d + 1} centre RGB {tuple(int(v) for v in c)}  near-left-edge RGB {tuple(int(v) for v in e)}")
