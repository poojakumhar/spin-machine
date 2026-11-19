"""Pixel measurements of the reel faces.
usage: python scripts/measure_face.py <face.png> <face_nofront.png> <rects.json> [label]
 face.png         screenshot with the live words/images hidden (face + rings + ornaments)
 face_nofront.png same, with the front frame (rings, ornaments) hidden: pixels that differ are "covered by the front"
 rects.json       {"cx":[...], "k":scale, "x0":machine left, "y0":machine top}  (screen px; ref coords * 0.9375 * scale)
Prints: max neighbouring-pixel luminance jump along each panel's vertical and horizontal centre lines (front-covered pixels
and the 4px around them are skipped), and the CIE Lab colour of each panel centre with the pairwise differences.
"""
import json, sys
import numpy as np
from PIL import Image


def lum(a):
    a = a.astype(np.float64)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def to_lab(rgb):
    c = np.asarray(rgb, np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = M @ c / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def run(face_p, nof_p, rects_p, label=""):
    face = np.asarray(Image.open(face_p).convert("RGB"))
    nof = np.asarray(Image.open(nof_p).convert("RGB"))
    R = json.load(open(rects_p))
    s = R["k"] * 0.9375
    covered = (np.abs(face.astype(int) - nof.astype(int)).sum(2) > 6)
    # grow the covered area by 4px so "ring edges" are excluded
    from scipy.ndimage import binary_dilation
    covered = binary_dilation(covered, iterations=4)
    L = lum(face)
    res = []
    for i, cx in enumerate(R["cx"]):
        X = int(round(R["x0"] + cx * s))
        y_a, y_b = int(round(R["y0"] + 125 * s)), int(round(R["y0"] + 800 * s))
        col = L[y_a:y_b, X]; cov = covered[y_a:y_b, X]
        d = np.abs(np.diff(col)); ok = ~(cov[1:] | cov[:-1])
        dv = d[ok]; vmax = float(dv.max()) if len(dv) else 0.0
        vbad = int((dv > 2.0).sum())
        ks = np.ones(3) / 3.0
        cs = np.convolve(col, ks, mode='same'); ds = np.abs(np.diff(cs))[1:-1]; oks = ok[1:-1] & ~(cov[2:] | cov[:-2])[:len(ds)] if False else ok[1:-1]
        vsmax = float(ds[oks].max()) if oks.any() else 0.0; vsbad = int((ds[oks] > 2.0).sum())
        Y = int(round(R["y0"] + 450 * s))
        x_a, x_b = int(round(R["x0"] + (cx - 235) * s)), int(round(R["x0"] + (cx + 235) * s))
        row = L[Y, x_a:x_b]; cr = covered[Y, x_a:x_b]
        dh = np.abs(np.diff(row)); okh = ~(cr[1:] | cr[:-1]); dh = dh[okh]
        hmax = float(dh.max()) if len(dh) else 0.0; hbad = int((dh > 2.0).sum())
        rs = np.convolve(row, np.ones(3) / 3.0, mode='same'); dhs = np.abs(np.diff(rs))[1:-1]; okhs = okh[1:-1]
        hsmax = float(dhs[okhs].max()) if okhs.any() else 0.0; hsbad = int((dhs[okhs] > 2.0).sum())
        cy = int(round(R["y0"] + 450 * s))
        patch = face[cy - 20:cy + 20, X - 20:X + 20].reshape(-1, 3).mean(0)
        res.append(dict(panel=i + 1, vmax=vmax, vbad=vbad, hmax=hmax, hbad=hbad, vsmax=vsmax, vsbad=vsbad, hsmax=hsmax, hsbad=hsbad, centre=patch, lab=to_lab(patch), vlen=int(ok.sum()), hlen=int(okh.sum())))
    print(f"--- {label}")
    for r in res:
        print(f"  panel {r['panel']}: RAW      vertical max {r['vmax']:.1f} ({r['vbad']} over 2 of {r['vlen']} px)   horizontal max {r['hmax']:.1f} ({r['hbad']} over 2 of {r['hlen']} px)   centre RGB {tuple(int(round(v)) for v in r['centre'])}")
        print(f"           SMOOTHED(3px) vertical max {r['vsmax']:.2f} ({r['vsbad']} over 2)   horizontal max {r['hsmax']:.2f} ({r['hsbad']} over 2)")
    dE = [float(np.linalg.norm(res[a]['lab'] - res[b]['lab'])) for a, b in ((0, 1), (0, 2), (1, 2))]
    print(f"  centre colour difference (CIE76 dE): 1-2 {dE[0]:.2f}, 1-3 {dE[1]:.2f}, 2-3 {dE[2]:.2f}   max {max(dE):.2f}")
    return dict(panels=res, dE=dE)


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "")
