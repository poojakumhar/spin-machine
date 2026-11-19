"""Cuts the top and bottom ornaments out of reference/ref-2-drum.png (the softer style from the first version).
Writes public/frame/orn-top.png, public/frame/orn-bot.png and components/ornaments.json (size + ruby centre, in ref-2 px).
Run: python scripts/build_ornaments.py
"""
import json
import cv2
import numpy as np

im = cv2.imread("reference/ref-2-drum.png", cv2.IMREAD_COLOR)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
hue, sat, val = hsv[..., 0].astype(np.float32) * 2, hsv[..., 1] / 255.0, hsv[..., 2]

def fill_holes(m):
    cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = m.copy()
    if hier is not None:
        for c, h in zip(cnts, hier[0]):
            if h[3] != -1 and cv2.contourArea(c) < 1500:
                cv2.drawContours(out, [c], -1, 1, -1)
    return out

def grab_mask(box):
    """Shape-aware cut (GrabCut), seeded from the bright gold and the ruby; used where the background is gold-brown too."""
    x0, y0, x1, y1 = box
    sub = im[y0:y1, x0:x1].copy()
    hs = cv2.cvtColor(sub, cv2.COLOR_BGR2HSV)
    h, s_, v = hs[..., 0].astype(np.float32) * 2, hs[..., 1] / 255.0, hs[..., 2]
    mk = np.full(sub.shape[:2], cv2.GC_PR_BGD, np.uint8)
    mk[((v > 205) & (s_ > 0.45) & (h > 32) & (h < 60)) | (((h < 15) | (h > 330)) & (s_ > 0.45) & (v > 60))] = cv2.GC_FGD
    mk[:4, :] = mk[-4:, :] = cv2.GC_BGD; mk[:, :4] = mk[:, -4:] = cv2.GC_BGD
    mk[(s_ < 0.55) & (v < 238) & (h > 22) & (h < 42)] = cv2.GC_BGD      # tan parchment is never ornament
    cv2.setRNGSeed(1)
    cv2.grabCut(sub, mk, None, np.zeros((1, 65)), np.zeros((1, 65)), 8, cv2.GC_INIT_WITH_MASK)
    m = ((mk == cv2.GC_FGD) | (mk == cv2.GC_PR_FGD)).astype(np.uint8)
    n, l, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, 4] > 300:
            keep[l == i] = 1
    return cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

def cut(name, box, gold_sat, vmin=120, hmin=25, grab=False):
    x0, y0, x1, y1 = box
    s, v, h = sat[y0:y1, x0:x1], val[y0:y1, x0:x1], hue[y0:y1, x0:x1]
    gold = (s > gold_sat) & (v > vmin) & (h > hmin) & (h < 60)
    ruby = ((h < 15) | (h > 330)) & (s > 0.45) & (v > 60)
    m = (gold | ruby).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    m = fill_holes(m)
    if grab:
        m = grab_mask(box)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
    # keep the component holding the ruby plus any large pieces (the scroll arms)
    rb = ruby.astype(np.uint8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        bx, by, bw, bh = st[i, 0], st[i, 1], st[i, 2], st[i, 3]
        touches = bx == 0 or by == 0 or bx + bw >= m.shape[1] or by + bh >= m.shape[0]
        if (st[i, cv2.CC_STAT_AREA] > 400 and not touches) or (rb & (lab == i)).any():
            keep[lab == i] = 1
    # drop pale parchment-coloured pixels (cut-out fringe, the faint glow above the gem): gold here is always saturated
    sub_hsv = hsv[y0:y1, x0:x1]
    pale = (sub_hsv[..., 1] / 255.0 < 0.58) & (sub_hsv[..., 2] < 248)
    edge = cv2.distanceTransform(keep, cv2.DIST_L2, 3) < 3.5        # only the outer rim of the cut-out, never inside the gold
    keep = (keep & ~(pale & edge)).astype(np.uint8)
    keep = (keep & ~(pale & (cv2.distanceTransform(keep, cv2.DIST_L2, 3) < 2.5))).astype(np.uint8)
    keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    nk, lk, sk, _ = cv2.connectedComponentsWithStats(keep)
    big = 1 + int(np.argmax(sk[1:, 4]))
    for i in range(1, nk):
        if sk[i, 4] < 120 or (sk[i, 3] < 14 and sk[i, 1] < 25 and i != big):
            keep[lk == i] = 0
    alpha = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.8)
    ys, xs = np.where(keep > 0)
    bx0, bx1, by0, by1 = max(0, xs.min() - 3), xs.max() + 4, max(0, ys.min() - 3), ys.max() + 4
    crop = np.dstack([im[y0:y1, x0:x1], (alpha * 255).astype(np.uint8)])[by0:by1, bx0:bx1]
    if name == "orn-top":
        gx_ = int(round(np.where(rb[by0:by1, bx0:bx1] > 0)[1].mean()))
        crop[:13, gx_ - 25:gx_ + 55, 3] = 0          # faint glow arc above the gem setting (not part of the ornament)
    cv2.imwrite(f"public/frame/{name}.png", crop)
    ry, rx = np.where(rb[by0:by1, bx0:bx1] > 0)
    gem = (float(rx.mean()), float(ry.mean()))
    print(name, "size", crop.shape[1], "x", crop.shape[0], "gem at", [round(g, 1) for g in gem])
    return dict(w=int(crop.shape[1]), h=int(crop.shape[0]), gx=round(gem[0], 1), gy=round(gem[1], 1))

meta = {"refWidth": 1600, "top": cut("orn-top", (130, 18, 510, 108), 0.55), "bot": cut("orn-bot", (120, 745, 505, 850), 0.62, grab=True)}
json.dump(meta, open("components/ornaments.json", "w"), indent=1)
