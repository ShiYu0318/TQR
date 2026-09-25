import numpy as np
from tqr.qr3 import qr_matrix
from tqr.egg2 import *
from tqr.eggcrate import read
from tqr.paths import DATA, FIGURES
links = {"T": "https://s.gd/top5", "N": "https://s.gd/nor1", "S": "https://s.gd/sou2",
         "E": "https://s.gd/eas3", "W": "https://s.gd/wes4"}
Q0 = {v: qr_matrix(l) for v, l in links.items()}
G, Q, rots = build_tile2(Q0, p=12, h=10)
np.save(DATA / "egg_G.npy", G)
print("rotations applied per view:", rots)
res = []
for v, el in [("T", 90), ("N", 35), ("E", 35), ("S", 35), ("W", 35)]:
    im = render2(G, AZ.get(v, 0), el, 300 / (4.0 / 12), light="mixed")
    im.save(FIGURES / f"egg4_{v}.png")
    zb, zx = read(im)
    got = set(zb) | {t for t, _ in zx}
    o = orientation_of(im, Q[v]) if any(t == links[v] for t, _ in zx) else None
    res.append((v, links[v] in got, o, got - {links[v]}))
for r in res: print(r)
