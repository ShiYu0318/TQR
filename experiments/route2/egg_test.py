import numpy as np, time
from tqr.qr3 import qr_matrix
from tqr.eggcrate import *
from tqr.paths import FIGURES
links = {"T": "https://s.gd/top5", "N": "https://s.gd/nor1", "S": "https://s.gd/sou2",
         "E": "https://s.gd/eas3", "W": "https://s.gd/wes4"}
Q = {v: qr_matrix(l) for v, l in links.items()}
G = build_tile(Q, p=10, h=8)
print("grid", G.shape)
dist = 300 / 0.4   # 30 cm at 0.4 mm/voxel
az_of = {"N": 0, "E": 90, "S": 180, "W": 270}
t = time.time()
for v, el in [("T", 90), ("N", 35), ("E", 35), ("S", 35), ("W", 35)]:
    im = render(G, az_of.get(v, 0), el, dist)
    im.save(FIGURES / f"egg_{v}.png")
    zb, zx = read(im)
    print(v, "expect", links[v], "| zbar", zb, "| zxing", zx)
print(f"{time.time()-t:.1f}s")
