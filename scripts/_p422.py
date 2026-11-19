s = open("scripts/build_drum3.py", encoding="utf8").read()
a = "        keep[:24] = 0                                  # the drum's own top edge, not part of the ornament\n"
assert a in s
s = s.replace(a, '''        # the drum's own top edge is not part of the ornament, but the ornament's small tip above the ruby is
        tip_x = int((s2[main, 0] + s2[main, 0] + s2[main, 2]) / 2)
        edge_rows = keep[:24].copy(); edge_rows[:, max(0, tip_x - 25):tip_x + 25] = 0
        keep[:24] -= edge_rows
''')
open("scripts/build_drum3.py", "w", encoding="utf8").write(s)
f = open("components/frame2.ts", encoding="utf8").read()
a = "y0: wy(0.013), y1: wy(1.0025)"
assert a in f
f = f.replace(a, "y0: wy(-0.034), y1: wy(0.9553)").replace('version: "3", faces: false', 'version: "4", faces: false')
open("components/frame2.ts", "w", encoding="utf8").write(f)
