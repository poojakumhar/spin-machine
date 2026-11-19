"""Cleans the light halo around cut-out animal PNGs.
Reads reference/originals/<name>.png (the untouched files) and writes public/reels/<name>.png.
Run: python scripts/defringe.py dog bullock
"""
import sys
import cv2
import numpy as np

for name in sys.argv[1:] or ["dog", "bullock"]:
    im = cv2.imread(f"reference/originals/{name}.png", cv2.IMREAD_UNCHANGED)
    rgb, a = im[..., :3].astype(np.float32), im[..., 3]
    solid = (a > 200).astype(np.uint8)
    core = cv2.erode(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))       # drop ~2px rim
    # colour of the rim pixels is contaminated by the old white background: pull colour from inside
    inner = cv2.erode(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    fill = cv2.inpaint(rgb.astype(np.uint8), (1 - inner).astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA).astype(np.float32)
    w = cv2.GaussianBlur(inner.astype(np.float32), (0, 0), 1.5)[..., None]
    rgb2 = rgb * w + fill * (1 - w)
    alpha = cv2.GaussianBlur(core.astype(np.float32), (0, 0), 0.9)
    out = np.dstack([np.clip(rgb2, 0, 255), alpha * 255]).astype(np.uint8)
    # Some source images are cropped with straight edges. Fade those edges to transparent so they melt into the parchment.
    # (fractions of the image width / height)
    FADES = {"bullock": {"left": 0.20, "bottom": 0.30}}
    fd = FADES.get(name)
    if fd:
        h_, w_ = out.shape[:2]
        ramp = np.ones((h_, w_), np.float32)
        if fd.get("left"):
            n = int(w_ * fd["left"]); r = np.clip(np.arange(w_) / n, 0, 1); ramp *= (r * r * (3 - 2 * r))[None, :]
        if fd.get("bottom"):
            n = int(h_ * fd["bottom"]); r = np.clip((h_ - 1 - np.arange(h_)) / n, 0, 1); ramp *= (r * r * (3 - 2 * r))[:, None]
        out[..., 3] = (out[..., 3].astype(np.float32) * ramp).astype(np.uint8)
    cv2.imwrite(f"public/reels/{name}.png", out)
    print(name, im.shape[:2], "alpha px before/after:", int((a > 128).sum()), int((out[..., 3] > 128).sum()))
