"""Usage: python make_tile.py URL_TOP URL_NORTH URL_EAST URL_SOUTH URL_WEST
Builds the five-view tile, checks all five design views, exports two aligned STLs."""
import sys, numpy as np
from qr3 import qr_matrix
from egg2 import build_tile2, render2, AZ
from eggcrate import read
from export_manifold import mask_to_mesh
from eggcrate import WHITE, BLACK
urls = dict(zip("TNESW", sys.argv[1:6]))
Q = {v: qr_matrix(u) for v, u in urls.items()}
sizes = {q.shape for q in Q.values()}
if len(sizes) > 1:
    n = max(s[0] for s in sizes); ver = (n - 17) // 4
    Q = {v: qr_matrix(u, version=ver) for v, u in urls.items()}   # all five must share one QR version
G, Qa, rots = build_tile2(Q, p=12, h=10)
np.save("egg_G.npy", G)
for v, el in (("T", 90), ("N", 40), ("E", 40), ("S", 40), ("W", 40)):
    zb, zx = read(render2(G, AZ.get(v, 0), el, 900, res=480))
    print(v, "OK" if urls[v] in set(zb) | {t for t, _ in zx} else "FAILED")
vox = 5.0 / 12
Gz = np.concatenate([np.full(G.shape[:2] + (3,), WHITE, np.uint8), G], axis=2)
for col, name in ((WHITE, "white"), (BLACK, "black")):
    tm, _, _ = mask_to_mesh(Gz == col, vox); tm.export(f"fiveview_tile_{name}.stl")
print("wrote fiveview_tile_white.stl / fiveview_tile_black.stl")
