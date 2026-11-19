"""First-version drum, built directly from reference/ref-2-drum.png.

The reference image IS the machine (its rings, rolled parchment edges and ornaments stay pixel-for-pixel).
Only the parchment inside each reel is repainted with one smooth shading, the same on all three reels, blended
softly into the original parchment next to the rings. Old content (words, scenes, bull) is removed first.
Writes:
  public/frame/drum.png          the whole machine without content (transparent outside the machine)
  public/frame/orn-*.png         the six ornaments again (drawn above the spinning content)
  components/faceShapes.json     faces (for layout), ornament placements, content centres
Run: python scripts/build_drum2.py
"""
import json
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter

img = cv2.imread("reference/ref-2-drum.png", cv2.IMREAD_COLOR)
H, W = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
hue, sat, val = hsv[..., 0].astype(np.float32) * 2, hsv[..., 1] / 255.0, hsv[..., 2].astype(np.float32)
work = img.copy()

# ---- 1. the bull's blanket covers part of ring 2 and its ear part of ring 3: repair from the mirror-image ring
def mirror_axis():
    best = None
    a = work[110:250, 505:600].astype(np.int32)
    xs = np.arange(505, 600)
    for s in range(1560, 1640):
        e = np.abs(a - work[110:250][:, s - xs].astype(np.int32)).mean()
        if best is None or e < best[0]:
            best = (e, s)
    return best[1]
for x in range(978, 1066):
    top, bot = work[284, x].astype(np.float32), work[402, x].astype(np.float32)
    for y in range(285, 402):
        t = (y - 284) / 118.0
        work[y, x] = (top * (1 - t) + bot * t).astype(np.uint8)

AX = mirror_axis()
xs = np.arange(536, 606)
orig = work.copy()
work[230:753, 536:606] = work[230:753][:, AX - xs]
for k in range(25):                                   # blend the repaired piece into the ring above and below it
    t = k / 25.0
    for y_, src in ((230 + k, 1 - t), (752 - k, 1 - t)):
        work[y_, 536:606] = (orig[y_, 536:606] * src + work[y_, 536:606] * (1 - src)).astype(np.uint8)
# ---- 2. ruby centres = content centres; ornament cut-outs (GrabCut, seeded from bright gold + ruby)
ruby = (((hue < 15) | (hue > 330)) & (sat > 0.55) & (val > 70)).astype(np.uint8)
def gems(y0, y1, xr):
    n, l, st, c = cv2.connectedComponentsWithStats(ruby[y0:y1])
    return sorted((float(c[i][0]), float(c[i][1]) + y0) for i in range(1, n) if st[i, 4] > 300 and xr[0] < c[i][0] < xr[1])
top_g = gems(10, 120, (0, W))
bot_g = gems(770, 840, (0, 500)) + gems(770, 840, (1100, W))
assert len(top_g) == 3 and len(bot_g) == 2, (top_g, bot_g)

def cut_ornament(box, name):
    x0, y0, x1, y1 = box
    sub = img[y0:y1, x0:x1].copy()
    hs = cv2.cvtColor(sub, cv2.COLOR_BGR2HSV)
    h, s_, v = hs[..., 0].astype(np.float32) * 2, hs[..., 1] / 255.0, hs[..., 2]
    mk = np.full(sub.shape[:2], cv2.GC_PR_BGD, np.uint8)
    mk[((v > 205) & (s_ > 0.45) & (h > 32) & (h < 60)) | (((h < 15) | (h > 330)) & (s_ > 0.45) & (v > 60))] = cv2.GC_FGD
    mk[:3, :] = mk[-3:, :] = cv2.GC_BGD; mk[:, :3] = mk[:, -3:] = cv2.GC_BGD
    mk[(s_ < 0.62) & (h > 20) & (h < 46)] = cv2.GC_BGD
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
                cv2.drawContours(keep, [c_], -1, 1, -1)
    ys, xs_ = np.where(keep > 0)
    bx0, by0, bx1, by1 = xs_.min(), ys.min(), xs_.max() + 1, ys.max() + 1
    a = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.8)
    cv2.imwrite(f"public/frame/{name}.png", np.dstack([sub, (a * 255).astype(np.uint8)])[by0:by1, bx0:bx1])
    full = np.zeros((H, W), np.float32); full[y0:y1, x0:x1] = a
    return dict(src=f"/frame/{name}.png", x=int(x0 + bx0), y=int(y0 + by0), w=int(bx1 - bx0), h=int(by1 - by0)), full

orns, orn_alpha = [], np.zeros((H, W), np.float32)
for k, (gx, gy) in enumerate(top_g):
    o, a = cut_ornament((int(gx) - 200, 12, int(gx) + 200, 112), f"orn-t{k + 1}"); orns.append(o); orn_alpha = np.maximum(orn_alpha, a)
for k, (gx, gy) in zip((1, 3), bot_g):
    o, a = cut_ornament((int(gx) - 200, 745, int(gx) + 200, 855), f"orn-b{k}"); orns.append(o); orn_alpha = np.maximum(orn_alpha, a)
o, a = cut_ornament((612, 812, 988, 870), "orn-b2"); orns.append(o); orn_alpha = np.maximum(orn_alpha, a)

# ---- 3. faces: between the inner edges of the rings, inside the parchment silhouette
white = (sat < 0.12) & (val > 236)
goldish = (sat > 0.78) & (val > 100)
centres = [top_g[0][0], top_g[1][0], top_g[2][0]]
# Inner edges of the four rings, measured on this reference at rows where no old lettering touches them
# (row: x). Each edge is fitted with a smooth curve.
EDGES = [
    {130: 97, 170: 77, 210: 68, 520: 60, 560: 63, 600: 68, 640: 76, 690: 87, 760: 116},           # ring 1, right side
    {130: 508, 170: 504, 210: 501, 480: 491, 520: 492, 560: 493, 600: 495, 640: 497, 690: 501},   # ring 2, left side
    {130: 581, 170: 573, 210: 568, 600: 567, 690: 575, 730: 581, 760: 589},                       # ring 2, right side
    {130: 1012, 170: 1020, 210: 1024, 480: 1034, 520: 1032, 560: 1029, 600: 1025, 640: 1021, 690: 1015, 730: 1010, 760: 1005},  # ring 3, left
    {130: 1089, 170: 1093, 210: 1096, 480: 1104, 520: 1104, 560: 1102, 600: 1101, 640: 1098, 730: 1091, 760: 1087},  # ring 3, right
    {130: 1498, 170: 1511, 210: 1520, 480: 1537, 520: 1534, 560: 1530, 600: 1526, 640: 1521, 690: 1509, 760: 1486},  # ring 4, left
]
yy = np.arange(H)
def curve(e, deg=2):
    ys_, xs_ = np.array(list(e.keys()), float), np.array(list(e.values()), float)
    return np.polyval(np.polyfit(ys_, xs_, deg), yy)
edge = [curve(e, 3 if i in (0, 5) else 2) for i, e in enumerate(EDGES)]
faces, face_masks = [], []
for d, c0 in enumerate(centres):
    # snap each row to the ring's real inner edge (walk from the fitted curve to the first gold pixel)
    gold_w = ((sat > 0.62) & (val > 70))
    def snap(curve_x, step):
        out = curve_x.copy()
        for y in range(H):
            x0 = int(round(curve_x[y])) + 6 * step          # start inside the face
            for k in range(0, 60):
                x = x0 - step * k
                if 0 <= x < W and gold_w[y, x] and gold_w[y, x - step]:
                    out[y] = x + step                         # first parchment pixel next to the ring
                    break
        return gaussian_filter1d(median_filter(out, 61, mode="nearest"), 4)
    Lf = snap(edge[2 * d], +1) - 1                          # tuck 1px under the ring so no old parchment shows
    Rf = snap(edge[2 * d + 1], -1) + 1
    cols = np.arange(int(Lf[100:800].min()), int(Rf[100:800].max()) + 1)
    t = np.array([np.where(~white[:, c])[0].min() for c in cols], float)
    b = np.array([np.where(~white[:, c])[0].max() for c in cols], float)
    # the rolled top and bottom edges are smooth curves: fit them on the open middle of the reel
    # (next to the rings the silhouette is the ring, not the parchment) and carry the curve out to the rings
    mid = (cols > cols.min() + 60) & (cols < cols.max() - 60)
    t_raw, b_raw = t.copy(), b.copy()
    t = np.polyval(np.polyfit(cols[mid], median_filter(t, 41, mode="nearest")[mid], 2), cols)
    b = np.polyval(np.polyfit(cols[mid], median_filter(b, 41, mode="nearest")[mid], 2), cols)
    t = np.maximum(t, t_raw); b = np.minimum(b, b_raw)       # never past the drum's own outline
    m = np.zeros((H, W), np.uint8)
    for i, c in enumerate(cols):
        ys_ = np.arange(int(t[i]), int(b[i]) + 1)
        ys_ = ys_[(c > Lf[ys_]) & (c < Rf[ys_])]
        m[ys_, c] = 1
    face_masks.append(m)
    pts = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
    pts = max(pts, key=cv2.contourArea).reshape(-1, 2)
    faces.append(dict(x0=float(cols.min()), y0=float(t.min()), x1=float(cols.max()), y1=float(b.max()),
                      cx=float((Lf[440] + Rf[440]) / 2), content_cx=round((top_g[d][0] + (bot_g[0 if d == 0 else 1][0] if d != 1 else top_g[1][0])) / 2, 1),
                      points=[[int(x), int(y)] for x, y in cv2.approxPolyDP(pts.reshape(-1, 1, 2), 1.0, True).reshape(-1, 2)]))
    print(f"face {d + 1}: x {cols.min()}..{cols.max()}  y {int(t.min())}..{int(b.max())}")

# ---- 4. remove old content inside the faces (words, scenes, bull, ornaments: ornaments come back on top)
base = work.copy()
hsv_w = cv2.cvtColor(work, cv2.COLOR_BGR2HSV)
sw, vw = hsv_w[..., 1] / 255.0, hsv_w[..., 2].astype(np.float32)
inner = np.zeros((H, W), np.uint8)
for m in face_masks:
    inner |= cv2.erode(m, np.ones((5, 5), np.uint8))
content = (inner > 0) & ((sw > 0.47) | (vw < 175))
smooth = cv2.medianBlur(work, 61).astype(np.float32)
dev = np.abs(work.astype(np.float32) - smooth).max(2)
content |= (inner > 0) & (dev > 22)              # anything that stands out from the parchment around it
content = cv2.dilate(content.astype(np.uint8), np.ones((7, 7), np.uint8)) & inner
base = cv2.inpaint(base, content * 255, 9, cv2.INPAINT_TELEA)
# specks of old lettering in the thin strip between a face and its ring
band = np.zeros((H, W), np.uint8)
for m in face_masks:
    band |= (cv2.dilate(m, np.ones((9, 9), np.uint8)) & (1 - m))
hb = cv2.cvtColor(base, cv2.COLOR_BGR2HSV)
specks = (band > 0) & (dev > 26) & (hb[..., 1] > 100) & (hb[..., 2] > 120)
specks = cv2.dilate(specks.astype(np.uint8), np.ones((3, 3), np.uint8))
nsp, lsp, ssp, _ = cv2.connectedComponentsWithStats(specks)
small = np.zeros_like(specks)
for i in range(1, nsp):
    if ssp[i, 4] < 160 and ssp[i, 3] < 30:
        small[lsp == i] = 1
base = cv2.inpaint(base, small * 255, 5, cv2.INPAINT_TELEA)
# two serif tips of the old letter "H" sit right against ring 2 (measured positions)
fixed = np.zeros((H, W), np.uint8)
for x0_, y0_, x1_, y1_ in ((480, 276, 494, 304), (480, 410, 494, 444)):
    blk = base[y0_:y1_, x0_:x1_]
    hb2 = cv2.cvtColor(blk, cv2.COLOR_BGR2HSV)
    fixed[y0_:y1_, x0_:x1_] = ((hb2[..., 1] > 90) & (hb2[..., 0] * 2 > 25) & (hb2[..., 0] * 2 < 50)).astype(np.uint8)
fixed = cv2.dilate(fixed, np.ones((3, 3), np.uint8))
base = cv2.inpaint(base, fixed * 255, 5, cv2.INPAINT_TELEA)

# ---- 5. one smooth shading per face, blended into the original parchment near the rings and the rolled edges
out = base.astype(np.float32)
light = np.array([253, 237, 202], np.float32)[::-1]
dark = np.array([206, 152, 92], np.float32)[::-1]
for d, m in enumerate(face_masks):
    f = faces[d]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx_, hw = (f["x0"] + f["x1"]) / 2, (f["x1"] - f["x0"]) / 2
    cy_, hh = (f["y0"] + f["y1"]) / 2, (f["y1"] - f["y0"]) / 2
    u = np.clip((xx - cx_) / hw, -1, 1); v = np.clip((yy - cy_) / hh, -1, 1)
    tt = np.clip(0.55 * u ** 2 + 0.42 * v ** 4, 0, 1)
    synth = light * (1 - tt[..., None]) + dark * tt[..., None]
    synth += np.random.default_rng(5 + d).normal(0, 1.1, synth.shape).astype(np.float32)
    dist = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    alpha = np.clip((dist - 3) / 16.0, 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)
    out = out * (1 - alpha[..., None]) + synth * alpha[..., None]

# leftover marks on the parchment side of a ring (old letter serifs next to ring 2, a fleck next to ring 4):
# repaint anything gold-coloured in these small boxes from the parchment around it
marks = np.zeros((H, W), np.uint8)
ob = np.clip(out, 0, 255).astype(np.uint8); hm = cv2.cvtColor(ob, cv2.COLOR_BGR2HSV)
for x0_, y0_, x1_, y1_ in ((474, 255, 491, 300), (474, 395, 491, 450), (1522, 400, 1536, 450)):
    sub = hm[y0_:y1_, x0_:x1_]
    marks[y0_:y1_, x0_:x1_] = (sub[..., 1] > 120).astype(np.uint8)
marks = cv2.dilate(marks, np.ones((5, 5), np.uint8))
out = cv2.inpaint(ob, marks * 255, 7, cv2.INPAINT_TELEA).astype(np.float32)
print("mark pixels repainted:", int(marks.sum()))
# the bump on ring 4's inner edge: rebuild those rows from the clean ring edge just above and below
ya, yb = 392, 434
for y_ in range(ya + 1, yb):
    t_ = (y_ - ya) / (yb - ya)
    out[y_, 1518:1546] = out[ya, 1518:1546] * (1 - t_) + out[yb, 1518:1546] * t_
# ornaments back on top (original pixels)
oa = orn_alpha[..., None]
out = out * (1 - oa) + img.astype(np.float32) * oa
out = np.clip(out, 0, 255).astype(np.uint8)

# ---- 6. transparent outside the machine
mask = np.zeros((H + 2, W + 2), np.uint8)
ff = out.copy()
for seed in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    cv2.floodFill(ff, mask, seed, (0, 0, 0), (12, 12, 12), (12, 12, 12), cv2.FLOODFILL_FIXED_RANGE | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
bg = cv2.dilate((mask[1:-1, 1:-1] > 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
alpha_out = cv2.GaussianBlur((~bg).astype(np.float32), (0, 0), 0.9)
cv2.imwrite("public/frame/drum.png", np.dstack([out, (alpha_out * 255).astype(np.uint8)]))
json.dump(dict(width=W, height=H, faces=faces, ornaments=orns), open("components/faceShapes.json", "w"), indent=1)
print("wrote drum.png, ornaments, faceShapes.json")
