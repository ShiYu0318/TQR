"""Five-view tile: (1) does render resolution change the low-elevation cutoff?  (2) sharp high-res frames per decoder."""
import numpy as np
from tqr.egg2 import render2
from tqr.eggcrate import read
from tqr.paths import DATA

G = np.load(DATA / "egg_G.npy"); d = 300 / (4.0 / 12)
link = "https://s.gd/nor1"
for res in (480, 1000):
    row = []
    for el in (20, 25, 30, 55, 60):
        zb, zx = read(render2(G, 0, el, d, res=res, blur=0.8 * res / 480))
        row.append(f"el{el}:{'O' if link in set(zb) | {x for x, _ in zx} else '.'}")
    print(f"res {res}px:", row)
links = {"T": "https://s.gd/top5", "N": "https://s.gd/nor1", "E": "https://s.gd/eas3"}
for v, az, el in (("T", 0, 90), ("N", 0, 40), ("E", 90, 40)):
    row = []
    for res, bl in ((900, 1.2), (1200, 1.0), (1200, 2.5), (1600, 3.3)):
        zb, zx = read(render2(G, az, el, d, res=res, blur=bl))
        row.append(f"{res}px/blur{bl}:{'Z' if links[v] in zb else '-'}{'X' if any(x == links[v] for x, _ in zx) else '-'}")
    print(v, row, "(Z = ZBar, X = ZXing)")
