"""Test drum (/test2), built from reference/ref-3-drum.png (clean three-reel drum on black, 2000 x 667).
The image is used as it is: only the black background is made transparent and the picture is cropped to the drum.
The six ornaments are cut out so the spinning content can pass under them.
Writes public/frame2/drum.png, public/frame2/orn-*.png, components/faceShapes2.json
Run: python scripts/build_drum3.py
"""
import json
import cv2
import numpy as np

src = cv2.imread("reference/ref-3-drum.png", cv2.IMREAD_COLOR)
# ---- background: flood from the corners over near-black
mask = np.zeros((src.shape[0] + 2, src.shape[1] + 2), np.uint8)
h0, w0 = src.shape[:2]
for seed in [(0, 0), (w0 - 1, 0), (0, h0 - 1), (w0 - 1, h0 - 1)]:
    cv2.floodFill(src.copy(), mask, seed, (0, 0, 0), (18, 18, 18), (18, 18, 18), cv2.FLOODFILL_FIXED_RANGE | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
bg = mask[1:-1, 1:-1] > 0
alpha = cv2.GaussianBlur((~bg).astype(np.float32), (0, 0), 0.8)
ys, xs = np.where(~bg)
X0, Y0, X1, Y1 = xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3
img = src[Y0:Y1, X0:X1].copy()
alpha = alpha[Y0:Y1, X0:X1]
# un-premultiply the dark fringe a little so the edge doesn't show a black halo on a light page
edge = (alpha > 0.02) & (alpha < 0.98)
img[edge] = np.clip(img[edge].astype(np.float32) / np.maximum(alpha[edge][:, None], 0.35), 0, 255).astype(np.uint8)
H, W = img.shape[:2]
print("drum", W, "x", H)

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
sat, val = hsv[..., 1] / 255.0, hsv[..., 2]

# ---- faces: the three large parchment areas (light, low saturation)
parch = ((sat < 0.38) & (val > 150)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(parch)
comps = sorted([i for i in range(1, n)], key=lambda i: -st[i, 4])[:3]
comps = sorted(comps, key=lambda i: st[i, 0])
faces = []
for i in comps:
    x, y, w, h = st[i, :4]
    m = (lab == i).astype(np.uint8)
    cols = np.where(m.sum(0) > 0.5 * h)[0]        # columns that are parchment over most of the height
    faces.append(dict(x0=int(x), y0=int(y), x1=int(x + w), y1=int(y + h), cx=float((cols.min() + cols.max()) / 2)))

# ---- ornaments: saturated gold/red shapes at the top and bottom of each face
smooth = cv2.medianBlur(img, 41).astype(np.float32)
dev = np.abs(img.astype(np.float32) - smooth).max(2)
gold = ((sat > 0.42) & (dev > 28)).astype(np.uint8)          # stands out from the parchment around it
gold = cv2.morphologyEx(gold, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
orns = []
orn_mask = np.zeros((H, W), np.uint8)
for d, f in enumerate(faces):
    xa, xb = f["x0"] + 6, f["x1"] - 6
    for tag, (ya, yb) in (("t", (0, int(H * 0.25))), ("b", (int(H * 0.72), H))):
        sub = np.zeros_like(gold)
        sub[ya:yb, xa:xb] = gold[ya:yb, xa:xb]
        sub = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        k, l2, s2, c2 = cv2.connectedComponentsWithStats(sub)
        # the ornament is the biggest shape near the face centre, plus any pieces close to it
        cand = [j for j in range(1, k) if s2[j, 4] > 30 and abs(c2[j][0] - f["cx"]) < 190 and s2[j, 1] > 3]
        main = max(cand, key=lambda j: s2[j, 4])
        bx, by, bw, bh = s2[main, :4]
        keep = np.zeros_like(sub)
        for j in cand:
            jx, jy, jw, jh = s2[j, :4]
            if jx > bx - 30 and jx + jw < bx + bw + 30 and jy > by - 20 and jy + jh < by + bh + 20:
                keep[l2 == j] = 1
        cnts, hier = cv2.findContours(keep, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        for c_, h_ in zip(cnts, hier[0]):
            if h_[3] != -1 and cv2.contourArea(c_) < 400:
                cv2.drawContours(keep, [c_], -1, 1, -1)
        keep[:24] = 0                                  # the drum's own top edge (and the tip above the ruby) stay on the drum
        orn_mask |= keep
        a = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.7)
        yy, xx = np.where(keep > 0)
        ox0, oy0, ox1, oy1 = xx.min() - 2, yy.min() - 2, xx.max() + 3, yy.max() + 3
        name = f"orn-{tag}{d + 1}"
        cv2.imwrite(f"public/frame2/{name}.png", np.dstack([img, (a * 255).astype(np.uint8)])[oy0:oy1, ox0:ox1])
        orns.append(dict(src=f"/frame2/{name}.png", x=int(ox0), y=int(oy0), w=int(ox1 - ox0), h=int(oy1 - oy0)))
        if tag == "t":
            f["content_cx"] = round(float((xx.min() + xx.max()) / 2), 1)
    print(f"face {d + 1}: x {f['x0']}..{f['x1']} y {f['y0']}..{f['y1']}  centre {f['content_cx']}")

# ---- taller drum: stretch only the height, so on screen (1440 wide) the drum is 810 tall like the first version.
# The ornaments are lifted off first and put back at their original size, centred where they land after the stretch,
# so only the parchment and the rings get taller.
S = 810 * W / (1440 * H)
H2 = int(round(H * S))
base = cv2.inpaint(img, cv2.dilate(orn_mask, np.ones((7, 7), np.uint8)) * 255, 9, cv2.INPAINT_TELEA)
base2 = cv2.resize(base, (W, H2), interpolation=cv2.INTER_CUBIC)
alpha2 = np.clip(cv2.resize(alpha, (W, H2), interpolation=cv2.INTER_LINEAR), 0, 1)
out = base2.astype(np.float32)
for o in orns:
    p = cv2.imread("public/frame2/" + o["src"].split("/")[-1], cv2.IMREAD_UNCHANGED)
    # top ornaments keep their top under the ruby's tip (which stays on the drum); bottom ones stay centred
    o["y"] = int(round(o["y"] * S)) if o["src"].split("/")[-1].startswith("orn-t") else int(round((o["y"] + o["h"] / 2) * S - o["h"] / 2))
    a = p[..., 3:4].astype(np.float32) / 255
    region = out[o["y"]:o["y"] + o["h"], o["x"]:o["x"] + o["w"]]
    region[:] = region * (1 - a) + p[..., :3].astype(np.float32) * a
cv2.imwrite("public/frame2/drum.png", np.dstack([np.clip(out, 0, 255).astype(np.uint8), (alpha2 * 255).astype(np.uint8)]))
for f in faces:
    f["y0"], f["y1"] = int(round(f["y0"] * S)), int(round(f["y1"] * S))
print(f"stretched x{S:.3f}: drum {W} x {H2}")
json.dump(dict(width=W, height=H2, faces=faces, ornaments=orns), open("components/faceShapes2.json", "w"), indent=1)
print("ornaments:", [(o["src"].split("/")[-1], o["x"], o["y"], o["w"], o["h"]) for o in orns])
