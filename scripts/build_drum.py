"""Rebuilds the machine from reference/ref-2-drum.png (the first version's drum).

Writes:
  public/frame/frame-front.png       the four gold rings only (cleaned: smooth edges, no notches, no old parchment)
  public/frame/orn-<n>.png           the six ornaments, each cut from its own place in the reference
  components/faceShapes.json         per reel: outline of the parchment face (between its rings, following the reference's
                                     rolled top and bottom silhouette), content centre (ruby), and ornament placements
The parchment shading itself is CSS (app/face.css), the same smooth gradient on all three reels.
Run: python scripts/build_drum.py
"""
import json
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter

SRC = "reference/ref-2-drum.png"
img = cv2.imread(SRC, cv2.IMREAD_COLOR)
H, W = img.shape[:2]

# ---------------------------------------------------------------- 1. remove what overlaps the rings in the source
# The bull's blanket covers part of ring 2, and its ear part of ring 3. Rings 2 and 3 are mirror images of each other,
# so ring 2's covered part is copied (mirrored) from ring 3; the ear is filled by vertical interpolation.
work = img.copy()
def mirror_axis():
    best = None
    a = work[110:250, 505:600].astype(np.int32)
    xs = np.arange(505, 600)
    for s in range(1560, 1640):
        b = work[110:250][:, s - xs].astype(np.int32)
        e = np.abs(a - b).mean()
        if best is None or e < best[0]:
            best = (e, s)
    return best[1]
AX = mirror_axis()
xs = np.arange(536, 606)
work[255:728, 536:606] = work[255:728][:, AX - xs]
for x in range(978, 1066):
    top, bot = work[284, x].astype(np.float32), work[402, x].astype(np.float32)
    for y in range(285, 402):
        t = (y - 284) / 118.0
        work[y, x] = (top * (1 - t) + bot * t).astype(np.uint8)

hsv = cv2.cvtColor(work, cv2.COLOR_BGR2HSV)
hue, sat, val = hsv[..., 0].astype(np.float32) * 2, hsv[..., 1] / 255.0, hsv[..., 2]

# ---------------------------------------------------------------- 2. rings
gold = ((sat > 0.82) & (val > 90)).astype(np.uint8)
gold_c = cv2.morphologyEx(gold, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
er = cv2.erode(gold_c, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
ne, le, se, ce = cv2.connectedComponentsWithStats(er, connectivity=8)
# pieces of the same ring (split where something crossed it in the source) are merged by their x position
pieces = [(ce[i][0], i) for i in range(1, ne) if se[i, cv2.CC_STAT_HEIGHT] > 120]
groups = []
for cx_, i in sorted(pieces):
    if groups and abs(cx_ - groups[-1][0]) < 45:
        groups[-1][1].append(i)
    else:
        groups.append([cx_, [i]])
groups = [g_ for g_ in groups if sum(se[i, cv2.CC_STAT_HEIGHT] for i in g_[1]) > 0.55 * H]
assert len(groups) == 4, f"expected 4 rings, found {[(int(g_[0]), len(g_[1])) for g_ in groups]}"
cores = [(g_[0], g_[1]) for g_ in groups]
def runs(row):
    d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0] - 1))

def robust_fit(ys, xs, deg=4, tol=4.0):
    ok = np.ones(len(ys), bool)
    for _ in range(6):
        p = np.polyfit(ys[ok], xs[ok], deg)
        res = np.abs(np.polyval(p, ys) - xs)
        new_ok = res < max(tol, 2.5 * np.median(res[ok]))
        if (new_ok == ok).all():
            break
        ok = new_ok
    return p, ok

ring_env, rings = [], []
gold_w = ((sat > 0.75) & (val > 80))
START_Y = 200
RING_START_X = [44, 535, 1060, 1555]                   # ring centres at row 200 in ref-2 (measured)
for cx0 in RING_START_X:
    seed = gold_w[START_Y, int(cx0) - 40:int(cx0) + 40]
    xs0 = np.where(seed)[0] + int(cx0) - 40
    pred = float((xs0.min() + xs0.max()) / 2)
    YS, LO, HI = [], [], []
    for direction in (1, -1):
        p_ = pred
        y = START_Y if direction == 1 else START_Y - 1
        miss = 0
        while 0 <= y < H and miss < 25:
            hw = 40
            x0_ = int(max(0, p_ - hw)); x1_ = int(min(W, p_ + hw))
            xs = np.where(gold_w[y, x0_:x1_])[0]
            if len(xs) >= 10:
                lo_, hi_ = x0_ + xs.min(), x0_ + xs.max()
                if 30 <= hi_ - lo_ <= 80:
                    YS.append(y); LO.append(lo_); HI.append(hi_)
                    p_ = 0.8 * p_ + 0.2 * (lo_ + hi_) / 2
                    miss = 0
                else:
                    miss += 1
            else:
                miss += 1
            y += direction
    YS, LO, HI = np.array(YS, float), np.array(LO, float), np.array(HI, float)
    pl, okl = robust_fit(YS, LO, deg=4, tol=3.0); ph, okh = robust_fit(YS, HI, deg=4, tol=3.0)
    yy = np.arange(H)
    lo, hi = np.polyval(pl, yy), np.polyval(ph, yy)
    y_a, y_b = int(YS.min()), int(YS.max())
    env = np.zeros((H, W), bool)
    for y in range(y_a, y_b + 1):
        end = min(y - y_a, y_b - y)
        shrink = 0.0
        if end < 14:
            r = (14 - end) / 14.0
            shrink = (1 - np.sqrt(max(0.0, 1 - r * r))) * (hi[y] - lo[y]) * 0.5
        env[y, int(round(lo[y] + shrink)):int(round(hi[y] - shrink)) + 1] = True
    ring_env.append(env)
    rings.append(dict(lo=lo, hi=hi, y_a=y_a, y_b=y_b))
    print(f"ring at x~{int(np.median((lo + hi)[y_a:y_b] / 2))}  rows {y_a}..{y_b}  width ~{int(np.median((hi - lo)[y_a:y_b]))}  fit on {int(okl.sum())}/{len(YS)}")

union = np.zeros((H, W), bool)
for e in ring_env:
    union |= e
# The outer rings' ends arc over onto the drum: take those ends straight from the reference's gold shape, joined to the fitted ring.
def fill_holes_small(m, max_area=2500):
    cnts, hier = cv2.findContours(m.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = m.astype(np.uint8).copy()
    if hier is not None:
        for c_, h_ in zip(cnts, hier[0]):
            if h_[3] != -1 and cv2.contourArea(c_) < max_area:
                cv2.drawContours(out, [c_], -1, 1, -1)
    return out
# The outer rings are not covered by anything in the reference, so use their own shape over the full height
# (keeps the real curl at the ends). Only the two dividers use the fitted shape.
not_white = ~((sat < 0.12) & (val > 236))
for k, side in ((0, "L"), (3, "R")):
    fitted = ring_env[k].copy()
    union &= ~ring_env[k]
    near = cv2.dilate(fitted.astype(np.uint8), np.ones((1, 25), np.uint8)) > 0       # within 12 px sideways of the fitted ring
    box = np.zeros((H, W), np.uint8)
    for y in range(H):
        lim = 150 if y < 45 else 136                     # stop short of the ornament scroll arms
        if side == "L":
            box[y, :lim] = 1
        else:
            box[y, W - lim:] = 1
    piece = (gold_w.astype(np.uint8) & box)
    piece = cv2.morphologyEx(piece, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    piece = fill_holes_small(piece, 6000)
    piece &= box & not_white.astype(np.uint8)
    ends = np.zeros((H, W), bool); ends[:165] = True; ends[740:] = True
    piece &= (near | ends).astype(np.uint8)
    n_, l_, st_, _ = cv2.connectedComponentsWithStats(piece)
    big = 1 + int(np.argmax(st_[1:, 4]))
    union |= (l_ == big)
    ring_env[k] = (l_ == big)

fill = (union & (gold_c == 0)).astype(np.uint8)                           # notches and slots inside a ring outline
art = cv2.inpaint(work, cv2.dilate(fill, np.ones((3, 3), np.uint8)) * 255, 6, cv2.INPAINT_TELEA) if fill.any() else work
alpha = cv2.GaussianBlur(union.astype(np.float32), (0, 0), 0.8)
RAMP = 14                                                               # the source cuts the outer ring ends flat: round both alike
ex = np.minimum(np.arange(W, dtype=np.float32), W - 1 - np.arange(W, dtype=np.float32))
ramp = np.clip(ex / RAMP, 0, 1); ramp = ramp * ramp * (3 - 2 * ramp)
front = np.dstack([art, np.clip(alpha * ramp[None, :] * 255, 0, 255).astype(np.uint8)])
cv2.imwrite("public/frame/frame-front.png", front)

# ---------------------------------------------------------------- 3. ornaments (GrabCut seeded from bright gold + ruby)
def cut_ornament(box, name):
    x0, y0, x1, y1 = box
    sub = img[y0:y1, x0:x1].copy()
    hs = cv2.cvtColor(sub, cv2.COLOR_BGR2HSV)
    h, s_, v = hs[..., 0].astype(np.float32) * 2, hs[..., 1] / 255.0, hs[..., 2]
    mk = np.full(sub.shape[:2], cv2.GC_PR_BGD, np.uint8)
    mk[((v > 205) & (s_ > 0.45) & (h > 32) & (h < 60)) | (((h < 15) | (h > 330)) & (s_ > 0.45) & (v > 60))] = cv2.GC_FGD
    mk[:3, :] = mk[-3:, :] = cv2.GC_BGD; mk[:, :3] = mk[:, -3:] = cv2.GC_BGD
    mk[(s_ < 0.62) & (h > 20) & (h < 46)] = cv2.GC_BGD                    # tan parchment (and its pale glow) is never ornament
    cv2.setRNGSeed(1)
    cv2.grabCut(sub, mk, None, np.zeros((1, 65)), np.zeros((1, 65)), 8, cv2.GC_INIT_WITH_MASK)
    m = ((mk == cv2.GC_FGD) | (mk == cv2.GC_PR_FGD)).astype(np.uint8)
    n, l, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, 4] > 300:
            keep[l == i] = 1
    keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    cnts, hier = cv2.findContours(keep, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hier is not None:
        for c_, h_ in zip(cnts, hier[0]):
            if h_[3] != -1 and cv2.contourArea(c_) < 1500:
                cv2.drawContours(keep, [c_], -1, 1, -1)        # pale highlights enclosed by gold stay
    ys, xs_ = np.where(keep > 0)
    bx0, by0, bx1, by1 = xs_.min(), ys.min(), xs_.max() + 1, ys.max() + 1
    a = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.8)
    rgba = np.dstack([sub, (a * 255).astype(np.uint8)])[by0:by1, bx0:bx1]
    cv2.imwrite(f"public/frame/{name}.png", rgba)
    return dict(src=f"/frame/{name}.png", x=int(x0 + bx0), y=int(y0 + by0), w=int(bx1 - bx0), h=int(by1 - by0))

ruby = (((hue < 15) | (hue > 330)) & (sat > 0.55) & (val > 70)).astype(np.uint8)
def gems(y0, y1, xr):
    n, l, st, c = cv2.connectedComponentsWithStats(ruby[y0:y1])
    return sorted((float(c[i][0]), float(c[i][1]) + y0) for i in range(1, n) if st[i, 4] > 300 and xr[0] < c[i][0] < xr[1])
top_g = gems(10, 120, (0, W))
bot_g = gems(770, 840, (0, 500)) + gems(770, 840, (1100, W))
assert len(top_g) == 3 and len(bot_g) == 2, (top_g, bot_g)
ornaments = []
for k, (gx, gy) in enumerate(top_g):
    ornaments.append(cut_ornament((int(gx) - 200, 12, int(gx) + 200, 112), f"orn-t{k + 1}"))
for k, (gx, gy) in zip((0, 2), bot_g):
    ornaments.append(cut_ornament((int(gx) - 200, 745, int(gx) + 200, 855), f"orn-b{k + 1}"))
ornaments.append(cut_ornament((612, 812, 988, 870), "orn-b2"))

# ---------------------------------------------------------------- 4. faces (parchment outline) and content centres
white = (sat < 0.10) & (val > 238)
faces = []
UNDER = 8
for d in range(3):
    A, B = rings[d]["hi"].copy(), rings[d + 1]["lo"].copy()             # inner edges of the two rings
    if d == 0 or d == 2:
        env = ring_env[0] if d == 0 else ring_env[3]
        for y in range(H):
            xs_r = np.where(env[y])[0]
            if len(xs_r):
                if d == 0: A[y] = xs_r.max()
                else: B[y] = xs_r.min()
        k_ = A if d == 0 else B
        k_[:] = gaussian_filter1d(median_filter(k_, 9, mode="nearest"), 2)
    ys_ok = [y for y in range(H) if B[y] - A[y] > 150 and rings[d]["y_a"] <= y <= rings[d]["y_b"] and rings[d + 1]["y_a"] <= y <= rings[d + 1]["y_b"]]
    ya, yb = min(ys_ok), max(ys_ok)
    xl, xr = int(np.median(A[ya:yb])), int(np.median(B[ya:yb]))
    cols = np.arange(xl - UNDER, xr + UNDER + 1)
    t = np.array([np.where(~white[:, min(max(c, xl + 6), xr - 6)])[0].min() for c in cols], float)
    b = np.array([np.where(~white[:, min(max(c, xl + 6), xr - 6)])[0].max() for c in cols], float)
    t = gaussian_filter1d(median_filter(t, 41, mode="nearest"), 6) + 2
    b = gaussian_filter1d(median_filter(b, 41, mode="nearest"), 6) - 2
    top_y, bot_y = float(t.min()), float(b.max())
    left = [(float(A[y]) - UNDER, float(y)) for y in range(int(top_y), int(bot_y) + 1, 6)]
    right = [(float(B[y]) + UNDER, float(y)) for y in range(int(bot_y), int(top_y) - 1, -6)]
    tops = [(float(c), float(tv)) for c, tv in zip(cols[::6], t[::6])]
    bots = [(float(c), float(bv)) for c, bv in zip(cols[::-6], b[::-6])]
    pts = [p for p in tops] + [(right[-1][0], top_y)] + right + bots + left
    pts = [(min(max(x, float(A[int(y)]) - UNDER), float(B[int(y)]) + UNDER), y) for x, y in pts]
    xs_ = [p[0] for p in pts]; ys_ = [p[1] for p in pts]
    cx_gem = top_g[d][0] if d == 1 else (top_g[d][0] + bot_g[0 if d == 0 else 1][0]) / 2
    faces.append(dict(x0=round(min(xs_), 1), y0=round(min(ys_), 1), x1=round(max(xs_), 1), y1=round(max(ys_), 1),
                      cx=round((xl + xr) / 2, 1), content_cx=round(cx_gem, 1),
                      points=[[round(x, 1), round(y, 1)] for x, y in pts]))
    print(f"face {d + 1}: x {min(xs_):.0f}..{max(xs_):.0f}  y {min(ys_):.0f}..{max(ys_):.0f}  content centre {cx_gem:.1f}")
json.dump(dict(width=W, height=H, faces=faces, ornaments=ornaments), open("components/faceShapes.json", "w"), indent=1)
print("wrote frame-front.png, 6 ornaments, faceShapes.json")
