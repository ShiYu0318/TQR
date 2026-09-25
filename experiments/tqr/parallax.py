# Test the derived limit: silhouette design needs viewing-ray spread < ~0.3/N rad.
# Shrink the object (2 mm modules -> 5.8 cm) and look from far away (telephoto regime).
import numpy as np, json
from tqr.qr3 import *
from tqr.verify_lib import render_persp
from tqr.paths import DATA
F = np.load(DATA / "F_best.npy"); k = 5
links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
N = F.shape[0] // k
print("N modules =", N, " predicted min distance d > N^2*s/0.3")
for s_mm in (2.0, 3.0):
    print(f"module {s_mm} mm (object {N*s_mm/10:.1f} cm), predicted d_min ~ {N*N*s_mm/0.3/10:.0f} cm")
    for dist_cm in (150, 250, 400, 600, 900):
        dist = dist_cm * 10 / (s_mm / k)
        r = []
        for axis, l in ((2, links[0]), (1, links[1]), (0, links[2])):
            S = render_persp(F, axis, dist)
            zb, zx = decode_all(to_image(S, pad_cells=40, blur=1.0, noise=8))
            r.append("OK" if (l in zb or l in zx) else "--")
        print(f"   {dist_cm:4d} cm: {r}")
